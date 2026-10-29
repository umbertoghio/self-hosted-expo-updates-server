import { feathers } from '@feathersjs/feathers'
import socketio from '@feathersjs/socketio'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as crypto from 'crypto'
import express from 'express'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import * as structuredHeaders from 'structured-headers'

import { getJSONInfo, handleAssetData, handleAssetResponse } from './asset'
import { normalizeUpdatePath, openUpdateFile, readUpdateFile, readUpdateFileAsync, updateFilePath } from './files'
import { getAssetMetadataSync, getMetadataAsync, getMetadataSync, getUpdateHash, getUpdateHashAsync } from './helpers'
import { checkSingleIntegrity } from './integrity'
import { handleManifestResponse, hanldeManifestData } from './manifest'
import { getLaunchAssetPath, getLaunchAssetPathAsync, getPatchFilePath } from './patch'

const parseDictionary = (structuredHeaders as unknown as { parseDictionary: (value: string) => Map<string, any> })
  .parseDictionary

let temporary: string
let root: string
let uploads: any[]
let queries: any[]
let patchDoc: any
let privateKey: string
let server: ReturnType<ReturnType<typeof express>['listen']>
const uploadPath = '/updates/test-app/runtime-1/new'
const oldPath = '/updates/test-app/runtime-1/old'
const physical = (logical: string) => path.join(root, logical.slice('/updates/'.length))
const metadata = () => ({
  fileMetadata: {
    ios: { bundle: 'bundles/ios.js', assets: [{ path: 'assets/icon.png', ext: 'png' }] },
    android: { bundle: 'bundles/android.js', assets: [] },
  },
})
const write = (logical: string, content: string | Buffer) => {
  fs.mkdirSync(path.dirname(physical(logical)), { recursive: true })
  fs.writeFileSync(physical(logical), content)
}
const writeMetadata = (data: any, logical = uploadPath) => write(`${logical}/metadata.json`, JSON.stringify(data))
const makeUpload = (logical: string, updateId: string, status = 'released') => {
  writeMetadata(metadata(), logical)
  write(`${logical}/bundles/ios.js`, `ios-${updateId}`)
  write(`${logical}/bundles/android.js`, `android-${updateId}`)
  write(`${logical}/assets/icon.png`, 'fixture-png')
  write(`${logical}/app.json`, JSON.stringify({ expo: { name: 'fixture' } }))
  write(`${logical}/package.json`, JSON.stringify({ dependencies: {} }))
  const filename = path.join(temporary, `${updateId}.zip`)
  fs.writeFileSync(filename, 'fixture-zip')
  return {
    _id: logical.split('/').at(-1),
    project: 'test-app',
    version: 'runtime-1',
    releaseChannel: 'production',
    status,
    path: logical,
    updateId,
    filename,
    updateHash: getUpdateHash(logical, root),
    releasedAt: status === 'released' ? '2026-01-01T00:00:00.000Z' : null,
    createdAt: '2025-12-31T00:00:00.000Z',
    appJson: { name: 'fixture' },
  }
}
const app = {
  service(name: string) {
    if (name === 'uploads')
      return {
        find: async ({ query }) => {
          queries.push(query)
          return uploads
            .filter((up) =>
              Object.entries(query).every(
                ([key, value]: any) =>
                  key.startsWith('$') || (value?.$in ? value.$in.includes(up[key]) : up[key] === value),
              ),
            )
            .slice(0, query.$limit || 10)
        },
      }
    if (name === 'apps') return { get: async () => ({ bsdiffEnabled: true, privateKey }) }
    if (name === 'patches')
      return {
        find: async () => (patchDoc ? [patchDoc] : []),
        patch: async () => ({}),
        create: async () => ({}),
        Model: { updateOne: async () => ({}) },
      }
    if (name === 'bsdiff-settings') return { find: async () => [] }
    throw new Error(`Unexpected fixture service: ${name}`)
  },
}
const params = (asset = `${uploadPath}/assets/icon.png`, extra: any = {}, headers = {}) => ({
  query: { asset, contentType: 'text/html', platform: 'ios', ...extra },
  headers,
})
const data = (asset?: string, extra?: any, headers?: any) => handleAssetData(app, params(asset, extra, headers), root)
const read = (result) => readUpdateFile(result.path, root).toString()
const close = (result) => expect(result).not.toHaveProperty('file')

beforeEach(() => {
  temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'expo-asset-test-'))
  root = path.join(temporary, 'updates')
  fs.mkdirSync(root)
  queries = []
  uploads = [makeUpload(uploadPath, 'new-update'), makeUpload(oldPath, 'old-update', 'obsolete')]
  patchDoc = null
  privateKey = undefined
})
afterEach(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
      server.closeIdleConnections()
    })
    server = undefined
  }
  fs.rmSync(temporary, { recursive: true, force: true })
})

describe('published asset boundary', () => {
  test('legacy URLs work, MIME comes from metadata, and lookup targets one upload', async () => {
    const result = await data()
    expect(result.type).toBe('asset')
    expect(result.contentType).toBe('image/png')
    expect(read(result)).toBe('fixture-png')
    close(result)
    expect(queries).toEqual([
      {
        _id: 'new',
        path: uploadPath,
        project: 'test-app',
        version: 'runtime-1',
        status: { $in: ['released', 'obsolete'] },
        $limit: 2,
      },
    ])
  })

  test('historical obsolete uploads remain downloadable after releasedAt is cleared', async () => {
    const result = await data(`${oldPath}/bundles/ios.js`)
    expect(read(result)).toBe('ios-old-update')
    close(result)
  })

  test.each(['ready', 'deleted'])('%s upload is not public', async (status) => {
    uploads[0].status = status
    await expect(data()).rejects.toThrow('Invalid or unpublished asset')
  })

  test('duplicate rows, deletedAt, unlisted files and operational metadata are denied', async () => {
    uploads.push({ ...uploads[0] })
    await expect(data()).rejects.toThrow()
    uploads.pop()
    uploads[0].deletedAt = new Date()
    await expect(data()).rejects.toThrow()
    delete uploads[0].deletedAt
    write(`${uploadPath}/secret.pem`, 'fixture-only-secret')
    for (const filename of ['secret.pem', 'metadata.json', 'app.json', 'package.json']) {
      await expect(data(`${uploadPath}/${filename}`)).rejects.toThrow()
    }
  })

  test('project/runtime/updateId/platform mismatches fail closed', async () => {
    for (const extra of [{ project: 'other' }, { version: 'other' }, { updateId: 'other' }, { platform: 'windows' }]) {
      await expect(data(undefined, extra)).rejects.toThrow()
    }
    await expect(data(undefined, {}, { 'expo-runtime-version': 'other' })).rejects.toThrow()
    await expect(data(`${uploadPath}/bundles/android.js`)).rejects.toThrow()
  })

  test.each([
    '/updates/../../etc/passwd',
    `${uploadPath}/../assets/icon.png`,
    `${uploadPath}//assets/icon.png`,
    `${uploadPath}/./assets/icon.png`,
    `${uploadPath}/assets\\icon.png`,
    `${uploadPath}/assets/%2e%2e/secret`,
    `${uploadPath}/assets/%252e%252e/secret`,
    `${uploadPath}/assets/icon.png\0`,
    '/updates-evil/a/b/c/file',
  ])('rejects ambiguous or escaping request %s', async (asset) => {
    await expect(data(asset)).rejects.toThrow()
    expect(() => normalizeUpdatePath(asset)).toThrow()
  })

  test('asset and parent symlinks are refused, even for allowlisted names', async () => {
    const secret = path.join(temporary, 'outside')
    fs.writeFileSync(secret, 'outside-bytes')
    const icon = physical(`${uploadPath}/assets/icon.png`)
    fs.unlinkSync(icon)
    fs.symlinkSync(secret, icon)
    await expect(data()).rejects.toThrow('Asset file is unavailable')
    fs.unlinkSync(icon)
    fs.rmdirSync(path.dirname(icon))
    fs.symlinkSync(temporary, path.dirname(icon))
    await expect(data()).rejects.toThrow()
  })

  test('directories cannot be streamed as regular asset files', async () => {
    fs.unlinkSync(physical(`${uploadPath}/assets/icon.png`))
    fs.mkdirSync(physical(`${uploadPath}/assets/icon.png`))
    await expect(data()).rejects.toThrow()
  })
})

describe('shared metadata reads and ready preflight compatibility', () => {
  test('upload-root symlinks and configuration JSON symlinks fail closed', () => {
    const original = root
    const link = path.join(temporary, 'linked-updates')
    fs.symlinkSync(original, link)
    expect(() => openUpdateFile(`${uploadPath}/assets/icon.png`, link)).toThrow()
    const appJSON = physical(`${uploadPath}/app.json`)
    fs.unlinkSync(appJSON)
    const secret = path.join(temporary, 'private-config.json')
    fs.writeFileSync(secret, '{"expo":{"private":true}}')
    fs.symlinkSync(secret, appJSON)
    expect(() => getJSONInfo(uploads[0], root)).toThrow()
  })

  test('normal metadata-relative ./ prefixes preserve emitted URLs and hashes', async () => {
    const value = metadata()
    value.fileMetadata.ios.bundle = './bundles/ios.js'
    value.fileMetadata.ios.assets[0].path = './assets/icon.png'
    writeMetadata(value)
    const result = await data()
    expect(result.path).toBe(`${uploadPath}/assets/icon.png`)
    close(result)
    const asset = getAssetMetadataSync(
      { update: uploads[0], filePath: './assets/icon.png', ext: 'png', isLaunchAsset: false, platform: 'ios' },
      root,
    )
    expect(asset.url).toContain(`asset=${uploadPath}/assets/icon.png&contentType=image/png&platform=ios`)
  })

  test('ready uploads still support sync/async metadata/hash and integrity preflight', async () => {
    const upload = uploads[0]
    upload.status = 'ready'
    upload.releasedAt = null
    expect(getMetadataSync(upload, root).createdAt).toBe(upload.createdAt)
    expect((await getMetadataAsync(upload, root)).metadataJson).toEqual(metadata())
    expect(await getUpdateHashAsync(upload.path, root)).toBe(getUpdateHash(upload.path, root))
    expect((await checkSingleIntegrity(upload, root)).errorCount).toBe(0)
    expect(getJSONInfo(upload, root)).toEqual({ appJson: { name: 'fixture' }, dependencies: {} })
  })

  test('all metadata readers reject a metadata symlink and enforce bounded reads', async () => {
    const filename = physical(`${uploadPath}/metadata.json`)
    fs.unlinkSync(filename)
    const outside = path.join(temporary, 'outside.json')
    fs.writeFileSync(outside, JSON.stringify(metadata()))
    fs.symlinkSync(outside, filename)
    expect(() => getMetadataSync(uploads[0], root)).toThrow()
    await expect(getMetadataAsync(uploads[0], root)).rejects.toThrow()
    expect(() => getUpdateHash(uploadPath, root)).toThrow()
    await expect(getUpdateHashAsync(uploadPath, root)).rejects.toThrow()
    fs.unlinkSync(filename)
    writeMetadata(metadata())
    expect(() => readUpdateFile(`${uploadPath}/metadata.json`, root, 5)).toThrow('too large')
    await expect(readUpdateFileAsync(`${uploadPath}/metadata.json`, root, 5)).rejects.toThrow('too large')
  })

  test.each(['../../outside', '/etc/passwd', 'assets/%2e%2e/secret', 'assets\\secret'])(
    'rejects metadata path %s',
    async (filename) => {
      expect(() => updateFilePath(uploadPath, filename)).toThrow()
      expect(() =>
        getAssetMetadataSync({ update: uploads[0], filePath: filename, isLaunchAsset: true, platform: 'ios' }, root),
      ).toThrow()
      const invalid = metadata()
      invalid.fileMetadata.ios.bundle = filename
      writeMetadata(invalid)
      expect(() => getLaunchAssetPath(uploads[0], 'ios', root)).toThrow()
      await expect(getLaunchAssetPathAsync(uploads[0], 'ios', root)).rejects.toThrow()
      await expect(data(`${uploadPath}/bundles/ios.js`)).rejects.toThrow()
    },
  )
})

const patchParams = () =>
  params(
    `${uploadPath}/bundles/ios.js`,
    { project: 'test-app', updateId: 'new-update' },
    {
      'a-im': 'bsdiff',
      'expo-current-update-id': 'old-update',
      'expo-requested-update-id': 'new-update',
    },
  )
describe('patch path boundary', () => {
  test('valid deterministic patch remains a 226 candidate', async () => {
    const patchPath = getPatchFilePath(uploads[0], uploads[1], 'ios')
    write(patchPath, 'BSDIFF40-fixture')
    patchDoc = { _id: 'patch', status: 'ready', path: patchPath }
    const result = await handleAssetData(app, patchParams(), root)
    expect(result.type).toBe('patch')
    expect((result as any).baseUpdateId).toBe('old-update')
    expect(read(result)).toBe('BSDIFF40-fixture')
    close(result)
  })

  test('DB paths outside the expected pair, symlinks and unpublished base use full bundle', async () => {
    const expected = getPatchFilePath(uploads[0], uploads[1], 'ios')
    write(expected, 'BSDIFF40-fixture')
    for (const badPath of [`${oldPath}/bundles/ios.js`, '/etc/passwd', `${uploadPath}/_patches/../../metadata.json`]) {
      patchDoc = { _id: 'patch', status: 'ready', path: badPath }
      const result = await handleAssetData(app, patchParams(), root)
      expect(result.type).toBe('asset')
      close(result)
    }
    fs.unlinkSync(physical(expected))
    fs.symlinkSync(physical(`${oldPath}/bundles/ios.js`), physical(expected))
    patchDoc.path = expected
    const result = await handleAssetData(app, patchParams(), root)
    expect(result.type).toBe('asset')
    close(result)
    uploads[1].status = 'ready'
    const readyBase = await handleAssetData(app, patchParams(), root)
    expect(readyBase.type).toBe('asset')
    close(readyBase)
  })
})

const start = async (beforeResponse?: (result: any, res: any) => void) => {
  const fixture = express()
  fixture.get('/api/assets', async (req, res) => {
    try {
      const result = await handleAssetData(app, { query: req.query, headers: req.headers }, root)
      beforeResponse?.(result, res)
      ;(res as any).data = result
      handleAssetResponse(res, root)
    } catch (error) {
      res.status(error.code || 400).end('denied')
    }
  })
  fixture.get('/api/manifest', async (req, res) => {
    try {
      ;(res as any).data = await hanldeManifestData(app, { query: req.query, headers: req.headers }, root)
      handleManifestResponse(res, req.headers['expo-protocol-version'])
    } catch (error) {
      res.status(error.code || 400).end('denied')
    }
  })
  server = fixture.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise((resolve) => server.once('listening', resolve))
  return `http://127.0.0.1:${(server.address() as any).port}`
}
const assetURL = (base: string, asset = `${uploadPath}/assets/icon.png`, extra = {}) =>
  `${base}/api/assets?${new URLSearchParams({ asset, contentType: 'text/html', platform: 'ios', ...extra })}`

describe('HTTP and native manifest compatibility', () => {
  test('socket.io calls never retain file descriptors in non-HTTP results', async () => {
    const fixture = feathers()
    fixture.configure(socketio({ transports: ['websocket'] }))
    fixture.use('api', {
      get: async (_id: string, request: any) => handleAssetData(app, request, root),
    })
    const listener = await (fixture as any).listen(0, '127.0.0.1')
    if (!listener.listening) await new Promise((resolve) => listener.once('listening', resolve))
    const ws = new WebSocket(`ws://127.0.0.1:${listener.address().port}/socket.io/?EIO=4&transport=websocket`)
    const waiting = new Map<number, (result: any[]) => void>()
    let connected: () => void
    const ready = new Promise<void>((resolve) => (connected = resolve))
    ws.onmessage = ({ data }) => {
      const packet = String(data)
      if (packet.startsWith('0')) ws.send('40')
      else if (packet.startsWith('40')) connected()
      else if (packet === '2') ws.send('3')
      else {
        const ack = packet.match(/^43(\d+)(.*)$/)
        if (ack) waiting.get(Number(ack[1]))?.(JSON.parse(ack[2]))
      }
    }
    let id = 0
    const call = async () => {
      const next = ++id
      const result = new Promise<any[]>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Fixture socket timeout')), 2000)
        waiting.set(next, (value) => {
          clearTimeout(timeout)
          waiting.delete(next)
          resolve(value)
        })
      })
      ws.send(`42${next}${JSON.stringify(['get', 'api', 'assets', params().query])}`)
      const [error, value] = await result
      expect(error).toBeNull()
      expect(value.type).toBe('asset')
      expect(value).not.toHaveProperty('file')
    }
    try {
      await Promise.race([
        ready,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Fixture socket connect timeout')), 2000)),
      ])
      await call()
      const fdDirectory = process.platform === 'linux' ? '/proc/self/fd' : '/dev/fd'
      const before = fs.readdirSync(fdDirectory).length
      for (let i = 0; i < 64; i++) await call()
      expect(fs.readdirSync(fdDirectory).length).toBeLessThanOrEqual(before)
    } finally {
      ws.close()
      await new Promise<void>((resolve) => (fixture as any).io.close(() => resolve()))
    }
  })

  test('HTTP query decoding rejects single/double traversal and serves valid legacy URL', async () => {
    const base = await start()
    const response = await fetch(assetURL(base))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toStartWith('image/png')
    expect(await response.text()).toBe('fixture-png')
    for (const encoded of ['%2e%2e', '%252e%252e', '%5c..', '%00']) {
      const response = await fetch(
        `${base}/api/assets?asset=${uploadPath}/${encoded}/secret&contentType=text/plain&platform=ios`,
      )
      expect(response.status).toBe(400)
    }
  })

  test('stream reads held FD after the allowed pathname is swapped to a symlink', async () => {
    const base = await start((result, res) => {
      const setType = res.type.bind(res)
      res.type = (value) => {
        // type() runs after the response has opened/verified its descriptor.
        const filename = physical(result.path)
        fs.renameSync(filename, `${filename}.original`)
        const secret = path.join(temporary, 'outside-secret')
        fs.writeFileSync(secret, 'must-not-be-served')
        fs.symlinkSync(secret, filename)
        return setType(value)
      }
    })
    const response = await fetch(assetURL(base))
    expect(response.status).toBe(200)
    expect(await response.text()).toBe('fixture-png')
  })

  test('HTTP response rejects a symlink swapped in after authorization but before opening', async () => {
    const base = await start((result) => {
      const filename = physical(result.path)
      fs.unlinkSync(filename)
      const secret = path.join(temporary, 'outside-secret')
      fs.writeFileSync(secret, 'must-not-be-served')
      fs.symlinkSync(secret, filename)
    })
    const response = await fetch(assetURL(base))
    expect(response.status).toBe(404)
    expect(await response.text()).toBe('')
  })

  test('226 patch headers and full 200 fallback remain compatible', async () => {
    const expected = getPatchFilePath(uploads[0], uploads[1], 'ios')
    write(expected, 'BSDIFF40-fixture')
    patchDoc = { _id: 'patch', status: 'ready', path: expected }
    const base = await start()
    const response = await fetch(
      assetURL(base, `${uploadPath}/bundles/ios.js`, { project: 'test-app', updateId: 'new-update' }),
      {
        headers: patchParams().headers,
      },
    )
    expect(response.status).toBe(226)
    expect(response.headers.get('im')).toBe('bsdiff')
    expect(response.headers.get('expo-base-update-id')).toBe('old-update')
    expect(await response.text()).toBe('BSDIFF40-fixture')
    const fallback = await fetch(assetURL(base, `${uploadPath}/bundles/ios.js`))
    expect(fallback.status).toBe(200)
    expect(await fallback.text()).toBe('ios-new-update')
  })

  test('manifest keeps native RSA signing bytes, keyid, runtime and existing resource URLs', async () => {
    const pair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    privateKey = pair.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString()
    const base = await start()
    const previousURL = process.env.PUBLIC_URL
    process.env.PUBLIC_URL = base
    try {
      const response = await fetch(`${base}/api/manifest`, {
        headers: {
          'expo-project': 'test-app',
          'expo-platform': 'ios',
          'expo-runtime-version': 'runtime-1',
          'expo-channel-name': 'production',
          'expo-expect-signature': 'sig, keyid="main", alg="rsa-v1_5-sha256"',
        },
      })
      expect(response.status).toBe(200)
      expect(response.headers.get('expo-protocol-version')).toBe('0')
      const body = await response.text()
      const manifestPart = body.split('\r\n\r\n')[1].split('\r\n--')[0]
      const signatureHeader = body.match(/expo-signature: ([^\r\n]+)/i)?.[1]
      const signature = parseDictionary(signatureHeader)
      expect(signature.get('keyid')[0]).toBe('main')
      expect(
        crypto.verify(
          'RSA-SHA256',
          Buffer.from(manifestPart),
          pair.publicKey,
          Buffer.from(signature.get('sig')[0] as string, 'base64'),
        ),
      ).toBe(true)
      const manifest = JSON.parse(manifestPart)
      expect(manifest.id).toBe('new-update')
      expect(manifest.runtimeVersion).toBe('runtime-1')
      expect(manifest.createdAt).toBe('2026-01-01T00:00:00.000Z')
      expect(manifest.launchAsset.url).toContain('&project=test-app&updateId=new-update')
      for (const asset of [...manifest.assets, manifest.launchAsset]) {
        const assetResponse = await fetch(asset.url)
        expect(assetResponse.status).toBe(200)
        const hash = crypto
          .createHash('sha256')
          .update(Buffer.from(await assetResponse.arrayBuffer()))
          .digest('base64url')
        expect(hash).toBe(asset.hash)
      }
    } finally {
      if (previousURL === undefined) delete process.env.PUBLIC_URL
      else process.env.PUBLIC_URL = previousURL
    }
  })
})
