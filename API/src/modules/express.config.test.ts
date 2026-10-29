import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import express from 'express'
import * as http from 'http'
import { gzipSync } from 'zlib'

import configureExpress from './express.config'

let server: http.Server
let port: number
let activeResponses: number

beforeEach(async () => {
  const fixture = express()
  configureExpress(express)(fixture as any)
  activeResponses = 0
  fixture.all('/__fixture/echo', (req, res) => res.json({ body: req.body }))
  fixture.get('/__fixture/health', (_req, res) => res.end('ok'))
  fixture.get('/__fixture/stream', (_req, res) => {
    activeResponses++
    res.type('text/plain')
    const interval = setInterval(() => res.write('fixture-data'.repeat(8192)), 1)
    res.on('close', () => {
      clearInterval(interval)
      activeResponses--
    })
  })
  fixture.use((error, _req, res, _next) => res.status(error.status || 500).end('rejected'))
  server = fixture.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve))
  port = (server.address() as { port: number }).port
})

afterEach(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
    server.closeIdleConnections()
  })
})

const request = (body: Buffer, contentType: string, chunked = false) =>
  new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: '/__fixture/echo',
        method: 'POST',
        headers: {
          'content-type': contentType,
          'content-encoding': 'gzip',
          ...(chunked ? {} : { 'content-length': String(body.length) }),
        },
      },
      (res) => {
        const chunks: Buffer[] = []
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString() }))
        res.on('error', reject)
      },
    )
    req.on('error', reject)
    if (chunked) {
      req.write(body.subarray(0, Math.floor(body.length / 2)))
      req.end(body.subarray(Math.floor(body.length / 2)))
    } else req.end(body)
  })

describe('HTTP parser and compression security compatibility', () => {
  test('valid gzip JSON and URL-encoded requests remain supported', async () => {
    const json = await request(gzipSync(Buffer.from('{"fixture":"ok"}')), 'application/json')
    expect(json.status).toBe(200)
    expect(JSON.parse(json.body)).toEqual({ body: { fixture: 'ok' } })
    const form = await request(gzipSync(Buffer.from('fixture=ok&count=2')), 'application/x-www-form-urlencoded', true)
    expect(form.status).toBe(200)
    expect(JSON.parse(form.body)).toEqual({ body: { fixture: 'ok', count: '2' } })
  })

  test('JSON limit counts inflated bytes, rather than the small compressed Content-Length', async () => {
    const compressed = gzipSync(Buffer.from(JSON.stringify({ fixture: 'x'.repeat(20 * 1024 * 1024) })))
    expect(compressed.length).toBeLessThan(100 * 1024)
    expect((await request(compressed, 'application/json')).status).toBe(413)
  })

  test('URL-encoded limit also rejects oversized inflated chunked requests', async () => {
    const compressed = gzipSync(Buffer.from('fixture=' + 'x'.repeat(5 * 1024 * 1024)))
    expect((await request(compressed, 'application/x-www-form-urlencoded', true)).status).toBe(413)
  })

  test('aborted compressed responses close their HTTP streams and leave the server responsive', async () => {
    for (let i = 0; i < 16; i++) {
      await new Promise<void>((resolve, reject) => {
        const req = http.get(
          { host: '127.0.0.1', port, path: '/__fixture/stream', headers: { 'accept-encoding': 'gzip' } },
          (res) => {
            expect(res.headers['content-encoding']).toBe('gzip')
            res.once('data', () => {
              res.destroy()
              req.destroy()
              resolve()
            })
            res.on('error', (error: NodeJS.ErrnoException) => {
              if (error.code !== 'ECONNRESET') reject(error)
            })
          },
        )
        req.on('error', (error: NodeJS.ErrnoException) => {
          if (error.code !== 'ECONNRESET') reject(error)
        })
      })
    }
    for (let i = 0; activeResponses && i < 20; i++) await Bun.sleep(5)
    expect(activeResponses).toBe(0)
    const response = await fetch(`http://127.0.0.1:${port}/__fixture/health`)
    expect(await response.text()).toBe('ok')
  })
})

// Keep parser regressions that could raise an uncaught stream error in an
// isolated fixture process. It imports only the HTTP configuration, no app
// bootstrap, database connection, production environment or signing key.
test('trailing compressed bytes do not terminate an isolated HTTP fixture', async () => {
  const code = `
    import express from 'express'
    import configure from ${JSON.stringify(__dirname + '/express.config.ts')}
    const app = express()
    configure(express)(app)
    app.all('/echo', (req,res) => res.json({ok:true}))
    app.get('/health', (req,res) => res.end('ok'))
    app.use((error,req,res,next) => res.status(error.status || 500).end('rejected'))
    const server = app.listen(0,'127.0.0.1',()=>console.log(server.address().port))
    setTimeout(()=>process.exit(99),10000)
  `
  const fixture = Bun.spawn([process.execPath, '--no-env-file', '--eval', code], {
    cwd: __dirname + '/../..',
    env: { NODE_ENV: 'production', PATH: '/usr/bin:/bin' },
    stdin: 'ignore',
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const reader = fixture.stdout.getReader()
  try {
    const first = await reader.read()
    const fixturePort = Number(new TextDecoder().decode(first.value).trim())
    expect(fixturePort).toBeGreaterThan(0)
    const frame = gzipSync(Buffer.from('{"fixture":true}'))
    for (const chunked of [false, true]) {
      await new Promise<void>((resolve, reject) => {
        const trailing = Buffer.from([0x01, 0x02, 0x03, 0x04])
        const req = http.request(
          {
            host: '127.0.0.1',
            port: fixturePort,
            path: '/echo',
            method: 'GET',
            headers: {
              'content-type': 'application/json',
              'content-encoding': 'gzip',
              ...(chunked
                ? { 'transfer-encoding': 'chunked' }
                : { 'content-length': String(frame.length + trailing.length) }),
            },
          },
          (res) => {
            res.resume()
            res.on('end', resolve)
            res.on('error', (error: NodeJS.ErrnoException) => (error.code === 'ECONNRESET' ? resolve() : reject(error)))
          },
        )
        // Closing the malformed request is valid; the independent health
        // probe below must still succeed, so a process crash cannot pass.
        req.on('error', (error: NodeJS.ErrnoException) => (error.code === 'ECONNRESET' ? resolve() : reject(error)))
        req.write(frame)
        setImmediate(() => req.end(trailing))
      })
      // Allow deferred decoder error events to run before probing liveness.
      await Bun.sleep(20)
      const response = await fetch(`http://127.0.0.1:${fixturePort}/health`)
      expect(response.status).toBe(200)
      expect(await response.text()).toBe('ok')
      expect(fixture.exitCode).toBeNull()
    }
  } finally {
    reader.releaseLock()
    fixture.kill()
    await fixture.exited
  }
})
