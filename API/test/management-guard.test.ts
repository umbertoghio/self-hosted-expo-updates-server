import { describe, test, expect, spyOn } from 'bun:test'
import { feathers } from '@feathersjs/feathers'
import express from '@feathersjs/express'
import * as http from 'http'

import configureExpress from '../src/modules/express.config'

import configureUpload from '../src/services/upload'
import appHooks, { getContextDetails } from '../src/hooks/app'
import { logger } from '../src/modules'

// Each service uses an in-memory store; these tests never read or write /uploads.
let registration: any
let blob: any
let routeHandlers: any[]
configureUpload({
  use: (_path: string, ...handlers: unknown[]) => {
    routeHandlers = handlers
    blob = handlers.at(-1)
  },
  service: () => ({
    hooks: (value: unknown) => {
      registration = value
    },
  }),
  get: () => 'test-only-guard-key',
} as any)
const fakeCounters = { remove: 0, read: 0, write: 0 }
blob.Model = {
  remove: (_data: unknown, callback: Function) => {
    fakeCounters.remove++
    callback(null)
  },
  createReadStream: () => {
    fakeCounters.read++
    throw Error('no actual blob reads')
  },
  createWriteStream: () => {
    fakeCounters.write++
    throw Error('no actual blob writes')
  },
}
const app = feathers()
app.use('upload', blob)
app.service('upload').hooks(registration)
app.set('uploadKey', 'test-only-guard-key')
const ctx = (provider: unknown, method: string) => ({ params: { provider }, method, data: {} })
const prepare = registration.before.create[0]

describe('real registered upload hooks', () => {
  for (const headers of [
    {},
    { 'release-channel': 'test' },
    { 'release-channel': 'test', 'upload-key': 'wrong' },
  ]) {
    test(`HTTP POST header gate rejects before multipart body consumption ${JSON.stringify(headers)}`, () => {
      const req: any = Object.freeze({
        method: 'POST',
        headers: Object.freeze(headers),
        get body() {
          throw Error('body must not be inspected')
        },
        get pipe() {
          throw Error('multipart stream must not be consumed')
        },
      })
      let multipartCalls = 0
      let error: any
      routeHandlers[0](req, {}, (e: unknown) => {
        error = e
        if (!e) {
          multipartCalls++
          routeHandlers[1](req, {}, () => {})
        }
      })
      expect(error).toMatchObject({ code: 400 })
      expect(multipartCalls).toBe(0)
      expect(req.headers).toBe(headers)
    })
  }
  test('HTTP valid keyed headers pass next unchanged without reading body', () => {
    const req: any = Object.freeze({
      method: 'POST',
      headers: Object.freeze({ 'release-channel': 'test', 'upload-key': 'test-only-guard-key' }),
      get body() {
        throw Error('body must not be inspected by gate')
      },
    })
    let calls = 0
    routeHandlers[0](req, {}, (error: unknown) => {
      expect(error).toBeUndefined()
      calls++
    })
    expect(calls).toBe(1)
    expect(req.headers['upload-key']).toBe('test-only-guard-key')
  })
  test('HTTP non-POST is denied before multipart middleware', () => {
    let calls = 0
    routeHandlers[0]({ method: 'GET' }, {}, (error: unknown) => {
      expect(error).toMatchObject({ code: 405 })
      calls++
    })
    expect(calls).toBe(1)
    expect(() => registration.before.get[0](ctx('rest', 'get'))).toThrow(
      expect.objectContaining({ code: 405 }),
    )
  })
  test('actual feathers-blob exposed methods are get/create/remove', () => {
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(blob)).filter((k) =>
      ['find', 'get', 'create', 'update', 'patch', 'remove'].includes(k),
    )
    expect(methods.sort()).toEqual(['create', 'get', 'remove'])
  })
  for (const provider of ['rest', 'socketio']) {
    for (const method of ['find', 'get', 'update', 'patch', 'remove']) {
      test(`${provider} ${method} is 405 even with user/JWT`, async () => {
        const c = {
          ...ctx(provider, method),
          params: {
            provider,
            user: { _id: 'fixture' },
            authentication: { accessToken: 'fixture' },
          },
        }
        expect(() => registration.before[method][0](c)).toThrow(
          expect.objectContaining({ code: 405 }),
        )
      })
    }
    for (const method of ['get', 'remove']) {
      test(`actual Feathers ${provider} ${method} stops before blob Model`, async () => {
        const before = { ...fakeCounters }
        await expect(
          (app.service('upload') as any)[method]('fixture', { provider }),
        ).rejects.toMatchObject({ code: 405 })
        expect(fakeCounters).toEqual(before)
      })
    }
  }
  test('internal no-provider hooks return original context', () => {
    for (const method of ['find', 'get', 'update', 'patch', 'remove']) {
      const c = ctx(undefined, method)
      expect(registration.before[method][0](c)).toBe(c)
    }
  })
  test('actual internal cleanup remove passes through fake store only', async () => {
    const before = fakeCounters.remove
    expect(await app.service('upload').remove('test-owned-memory-fixture')).toEqual({
      id: 'test-owned-memory-fixture',
    })
    expect(fakeCounters.remove).toBe(before + 1)
  })
  test('create missing release-channel is rejected unchanged', async () => {
    await expect(
      prepare({
        app,
        params: { provider: 'rest', headers: { 'upload-key': 'test-only-guard-key' } },
        data: { uri: 'data:text/plain;base64,QQ==' },
      }),
    ).rejects.toMatchObject({ code: 400, message: expect.stringContaining('release-channel') })
  })
  for (const key of [undefined, 'wrong-key']) {
    test(`create ${key ? 'wrong' : 'missing'} key rejects before storage`, async () => {
      const before = { ...fakeCounters }
      await expect(
        prepare({
          app,
          params: { provider: 'rest', headers: { 'release-channel': 'test', 'upload-key': key } },
          data: {},
        }),
      ).rejects.toMatchObject({ code: 400, message: expect.stringContaining('upload-key') })
      expect(fakeCounters).toEqual(before)
    })
  }
  for (const expected of [undefined, '', null, 123]) {
    test(`missing/empty/nonstring server key fails closed ${String(expected)}`, async () => {
      const invalidApp = { get: () => expected }
      let handlers: any[]
      configureUpload({
        ...invalidApp,
        use: (_path: string, ...items: any[]) => {
          handlers = items
        },
        service: () => ({ hooks: () => {} }),
      } as any)
      for (const provided of [undefined, '', 'test-only-guard-key']) {
        await expect(
          prepare({
            app: invalidApp,
            params: {
              provider: 'socketio',
              headers: { 'release-channel': 'test', 'upload-key': provided },
            },
            data: {},
          }),
        ).rejects.toMatchObject({ code: 400, message: expect.stringContaining('upload-key') })
        let result: any
        handlers![0](
          {
            method: 'POST',
            headers: { 'release-channel': 'test', 'upload-key': provided },
            get body() {
              throw Error('do not read')
            },
          },
          {},
          (e: unknown) => {
            result = e
          },
        )
        expect(result).toMatchObject({ code: 400 })
      }
    })
  }
  test('missing entire headers object is rejected without storage access', async () => {
    await expect(
      prepare({ app, params: { provider: 'socketio' }, data: {} }),
    ).rejects.toMatchObject({ code: 400 })
    expect(fakeCounters.write).toBe(0)
  })
  test('valid keyed URI prepare returns same context unchanged, without JWT', async () => {
    const c = {
      app,
      params: {
        provider: 'rest',
        headers: { 'release-channel': 'test', 'upload-key': 'test-only-guard-key' },
      },
      data: { uri: 'data:text/plain;base64,QQ==' },
    }
    const before = JSON.stringify(c.data)
    expect(await prepare(c)).toBe(c)
    expect(JSON.stringify(c.data)).toBe(before)
  })
  test('valid multipart ZIP prepare keeps existing conversion only', async () => {
    const c = {
      app,
      params: {
        provider: 'rest',
        headers: { 'release-channel': 'test', 'upload-key': 'test-only-guard-key' },
        file: {
          originalname: 'fixture.zip',
          mimetype: 'application/octet-stream',
          buffer: Buffer.from('test-only-no-upload'),
        },
      },
      data: {},
    }
    expect(await prepare(c)).toBe(c)
    expect(c.params.file.mimetype).toBe('application/zip')
    expect((c.data as any).uri).toBe(
      'data:application/zip;base64,' + Buffer.from('test-only-no-upload').toString('base64'),
    )
    expect(fakeCounters.write).toBe(0)
  })
})

describe('real HTTP upload middleware order', () => {
  test('rejects non-create multipart requests before buffering while CORS preflight still succeeds', async () => {
    const fixture = express(feathers())
    fixture.configure(configureExpress(express) as any)
    fixture.configure(express.rest())
    fixture.set('uploadKey', 'test-only-guard-key')
    const originalUse = fixture.use
    let multipartCalls = 0
    fixture.use = function (path: any, ...handlers: any[]) {
      if (path === '/upload') {
        const multipart = handlers[1]
        handlers[1] = (...args: any[]) => {
          multipartCalls++
          return multipart(...args)
        }
      }
      return originalUse.call(this, path, ...handlers)
    } as any
    configureUpload(fixture as any)
    fixture.use = originalUse
    const service = fixture.service('upload') as any
    service.Model = {
      createReadStream: () => {
        throw Error('unexpected blob read')
      },
      createWriteStream: () => {
        throw Error('unexpected blob write')
      },
      remove: () => {
        throw Error('unexpected blob remove')
      },
    }
    fixture.use((error: any, _req: any, res: any, _next: any) =>
      res.status(error.code || 500).end(),
    )
    const server = http.createServer(fixture)
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const port = (server.address() as any).port
    const request = (method: string, preflight = false) =>
      new Promise<number>((resolve, reject) => {
        const req = http.request(
          {
            host: '127.0.0.1',
            port,
            path: '/upload/fixture',
            method,
            headers: preflight
              ? { origin: 'https://fixture.invalid', 'access-control-request-method': 'POST' }
              : {
                  'content-type': 'multipart/form-data; boundary=fixture-boundary',
                  'content-length': '1000000',
                },
          },
          (res) => {
            res.resume()
            res.once('end', () => {
              req.destroy()
              resolve(res.statusCode!)
            })
          },
        )
        req.setTimeout(2000, () => req.destroy(Error('request body was awaited before rejection')))
        req.on('error', reject)
        // Deliberately leave the multipart body incomplete. Response must not wait for it.
        if (preflight) req.end()
        else req.write('x')
      })
    try {
      for (const method of ['GET', 'HEAD', 'PUT', 'PATCH', 'DELETE']) {
        expect(await request(method)).toBe(405)
      }
      expect(await request('OPTIONS', true)).toBe(204)
      expect(multipartCalls).toBe(0)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      )
    }
  })
})

describe('actual app error log redaction', () => {
  test('failed apps patch signing keys are redacted in error and debug logs without mutation', () => {
    const logged: unknown[][] = []
    const spies = (['info', 'error', 'debug'] as const).map((method) =>
      spyOn(logger, method).mockImplementation((...args: unknown[]) => {
        logged.push(args)
      }),
    )
    const data = Object.freeze({
      name: 'fixture-app',
      privateKey: 'fixture-private-pem',
      private_key: 'fixture-private-snake',
      'private-key': 'fixture-private-dash',
      PRIVATEKEY: 'fixture-private-upper',
    })
    const before = JSON.stringify(data)
    const context = {
      data,
      params: { provider: 'rest' },
      method: 'patch',
      path: 'apps',
      type: 'error',
      error: { code: 500, name: 'GeneralError', stack: 'fixture patch failed' },
      toJSON: () => ({ data }),
    }
    try {
      appHooks.error.all[0](context as any)
      const result = JSON.stringify(logged)
      for (const value of Object.values(data).filter((value) =>
        value.startsWith('fixture-private'),
      )) {
        expect(result).not.toContain(value)
      }
      const details: any = getContextDetails(context as any)
      for (const field of ['privateKey', 'private_key', 'private-key', 'PRIVATEKEY']) {
        expect(details.data[field]).toBe('[REDACTED]')
      }
      expect(JSON.stringify(context.data)).toBe(before)
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })

  test('deep values are truncated without changing the input', () => {
    const nested: any = { safe: 'retained' }
    let cursor = nested
    for (let i = 0; i < 12; i++) {
      cursor.child = {}
      cursor = cursor.child
    }
    cursor.password = 'deep-fixture-secret'
    const before = JSON.stringify(nested)
    const result = getContextDetails({ data: nested } as any)
    expect(JSON.stringify(result)).toContain('[Truncated]')
    expect(JSON.stringify(result)).not.toContain('deep-fixture-secret')
    expect(JSON.stringify(nested)).toBe(before)
  })

  test('nested fields redact all spellings without changing live context', () => {
    const c = {
      data: {
        username: 'test-user',
        password: 'pw-fixture-secret',
        PASSWORD: 'upper-secret',
        nested: [
          {
            accessToken: 'access-fixture',
            refresh_token: 'refresh-fixture',
            authorization: 'Bearer fixture',
            'upload-key': 'upload-fixture',
            uploadKey: 'camel-fixture',
            safe: 'retained',
          },
        ],
      },
      params: {
        provider: 'rest',
        query: { token: 'query-token-secret', safe: 'query-retained' },
        headers: {
          authorization: 'Bearer header-fixture',
          'upload-key': 'header-key-fixture',
          'x-forwarded-for': '127.0.0.1',
        },
      },
      method: 'create',
      path: 'authentication',
    }
    const before = JSON.stringify(c)
    const result: any = getContextDetails(c as any)
    expect(result.data.password).toBe('[REDACTED]')
    expect(result.data.PASSWORD).toBe('[REDACTED]')
    for (const k of ['accessToken', 'refresh_token', 'authorization', 'upload-key', 'uploadKey'])
      expect(result.data.nested[0][k]).toBe('[REDACTED]')
    expect(result.query.token).toBe('[REDACTED]')
    expect(result.data.nested[0].safe).toBe('retained')
    expect(result.ip).toBe('127.0.0.1')
    expect(JSON.stringify(c)).toBe(before)
  })
  test('both structured error details and debug inspect exclude credentials', () => {
    const logged: unknown[][] = []
    const spies = (['info', 'error', 'debug'] as const).map((method) =>
      spyOn(logger, method).mockImplementation((...args: unknown[]) => {
        logged.push(args)
      }),
    )
    try {
      const data = Object.freeze({
        username: 'fixture-user',
        password: 'never-log-password',
        token: 'never-log-token',
        authorization: 'never-log-auth',
        'upload-key': 'never-log-key',
      })
      const c = {
        data,
        params: { provider: 'socketio' },
        method: 'create',
        path: 'authentication',
        type: 'error',
        error: {
          code: 401,
          name: 'NotAuthenticated',
          stack: 'fixture authentication failed at fixture.ts:1',
        },
        toJSON: () => ({ data }),
      }
      appHooks.error.all[0](c as any)
      const result = JSON.stringify(logged)
      for (const v of Object.values(data).filter((x) => x.startsWith('never-log')))
        expect(result).not.toContain(v)
      expect(result).toContain('[REDACTED]')
      expect(data.password).toBe('never-log-password')
    } finally {
      for (const spy of spies) spy.mockRestore()
    }
  })
  test('cycles never return unsanitized originals', () => {
    const data: any = { password: 'cyclic-secret' }
    data.loop = data
    const result: any = getContextDetails({ data } as any)
    expect(result.data.password).toBe('[REDACTED]')
    expect(result.data.loop).toBe('[Circular]')
    expect(data.loop).toBe(data)
  })
})
