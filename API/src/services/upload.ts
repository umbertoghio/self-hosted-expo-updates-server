// feathers-blob service
import { hooks } from '@feathersjs/authentication-local'
import * as Err from '@feathersjs/errors'
import dauria from 'dauria'
import blobService from 'feathers-blob'
import * as fs from 'fs'
import * as nodePath from 'path'
import fsBlob from 'fs-blob-store'
import multer from 'multer'
import * as unzipper from 'unzipper'

import s from '../hooks/security'
import { getJSONInfo } from '../modules/expo/asset'
import { getUpdateHash, getUpdateId } from '../modules/expo/helpers'
import type { AppLike, HookContextLike, UnknownRecord, UploadRecord } from '../types'

const blobStorage = fsBlob('/uploads')
const multipartMiddleware = multer()
const { protect } = hooks

/* Sequential central-directory extraction.
 *
 * unzipper's streaming Extract() silently drops entries on real-world
 * `expo export` archives (dozens of small assets + multi-MB Hermes bundles):
 * the parser sees every entry, but the write path loses files with no error.
 * Reading via the central directory and writing entries one at a time
 * extracts 100% of the same archives. Verified 88/88 vs 52/88 locally.
 */
const extractZipSequential = async (zipFile: string, dest: string) => {
  const buffer = fs.readFileSync(zipFile)
  const directory = await unzipper.Open.buffer(buffer)
  for (const entry of directory.files) {
    // Zip-slip guard: never write outside the destination.
    const target = nodePath.join(dest, entry.path)
    const rel = nodePath.relative(dest, target)
    if (rel === '' || rel.startsWith('..') || nodePath.isAbsolute(rel)) continue
    if (entry.type === 'Directory') {
      fs.mkdirSync(target, { recursive: true })
      continue
    }
    fs.mkdirSync(nodePath.dirname(target), { recursive: true })
    fs.writeFileSync(target, await entry.buffer())
  }
}

interface BlobUploadResult extends UnknownRecord {
  id?: string
  contentType?: string
  size?: number
  uploadId?: string
  updateId?: string
  updateHash?: string
  project?: string
  releaseChannel?: string
  message?: string
}

interface UploadHookContext extends HookContextLike {
  result: BlobUploadResult
  data: UnknownRecord
  params: HookContextLike['params'] & {
    headers: Record<string, string | undefined>
    file?: {
      originalname: string
      mimetype: string
      buffer: Buffer
    }
  }
}

const createDocument = async (context: UploadHookContext) => {
  if (!context.result.id || !context.result.size) {
    throw new Err.GeneralError('Upload failed')
  }

  const upload = (await context.app.service('uploads')._create?.({
    createdAt: new Date(),
    originalname: context.params.file.originalname,
    filename: `/uploads/${context.result.id}`,
    size: context.result.size,
    project: context.params.headers.project,
    version: context.params.headers.version,
    releaseChannel: context.params.headers['release-channel'],
    gitBranch: context.params.headers['git-branch'] || 'Unknown',
    gitCommit: context.params.headers['git-commit'] || 'Unknown',
    status: 'ready',
  })) as UploadRecord

  const path = `/updates/${upload.project}/${upload.version}/${upload._id}`
  fs.rmSync(path, { recursive: true, force: true })
  fs.mkdirSync(path, { recursive: true })

  try {
    await extractZipSequential(upload.filename, path)
  } catch (e) {
    fs.rmSync(upload.filename, { force: true })
    fs.rmSync(path, { recursive: true, force: true })
    context.app.service('uploads').remove(upload._id)
    throw new Err.GeneralError('Error extracting the archive')
  }

  let appJson = null
  let dependencies = null
  let updateId = null
  let updateHash = null
  try {
    const info = getJSONInfo({ path })
    appJson = info.appJson
    dependencies = info.dependencies
    updateHash = getUpdateHash(path)
    updateId = getUpdateId(path, updateHash)
  } catch (e) {
    fs.rmSync(path, { recursive: true, force: true })
    fs.rmSync(upload.filename, { force: true })
    fs.rmSync(path, { recursive: true, force: true })
    context.app.service('uploads').remove(upload._id)
    throw new Err.BadRequest('No metadata.json found, was it included in the zip?')
  }

  await context.app.service('uploads')._patch(upload._id, { path, appJson, dependencies, updateId, updateHash })

  delete context.result.id
  delete context.result.contentType
  delete context.result.size
  context.result.uploadId = upload._id
  context.result.updateId = updateId
  context.result.updateHash = updateHash
  context.result.project = upload.project
  context.result.releaseChannel = upload.releaseChannel
  context.result.message = 'Upload successful, use the web UI to release id: ' + upload._id

  context.app.service('messages').create({ action: 'update', keys: 'uploads' })
  return context
}

const validateUploadHeaders = (app: AppLike, headers: Record<string, string | undefined> = {}) => {
  if (!headers['release-channel']) {
    throw new Err.BadRequest('Upload failed: missing release-channel header')
  }

  const expected = app.get('uploadKey')
  const provided = headers['upload-key']
  if (
    typeof expected !== 'string' || expected.length === 0 ||
    typeof provided !== 'string' || provided.length === 0 || provided !== expected
  ) {
    throw new Err.BadRequest('Upload failed: missing or wrong upload-key header')
  }
}

const prepareForUpload = async (context: UploadHookContext) => {
  validateUploadHeaders(context.app, context.params.headers)

  // Handle multipart content
  if (!context.data.uri && context.params.file) {
    if (context.params.file.originalname.endsWith('.zip')) {
      context.params.file.mimetype = 'application/zip'
    }
    const file = context.params.file
    const uri = dauria.getBase64DataURI(file.buffer, file.mimetype)
    context.data = { uri }
  }
  return context
}

const getHooks = () => ({
  before: {
    all: [],
    find: [s.externalMethodNotAllowed],
    get: [s.externalMethodNotAllowed],
    create: [prepareForUpload],
    update: [s.externalMethodNotAllowed],
    patch: [s.externalMethodNotAllowed],
    remove: [s.externalMethodNotAllowed],
  },
  after: {
    all: [],
    find: [],
    get: [],
    create: [protect('uri'), createDocument],
    update: [],
    patch: [],
    remove: [],
  },
})

export default (app: AppLike & { use(path: string, ...handlers: unknown[]): void }) => {
  const blob = blobService({ Model: blobStorage })
  // Reject unsupported methods and unauthorized POSTs before multer reads multipart bytes.
  // Socket.IO still passes through the same validation in prepareForUpload.
  const guardUploadRequest = (
    req: { method?: string; headers?: Record<string, string | undefined> },
    res: unknown,
    next: (error?: unknown) => void,
  ) => {
    if (req.method !== 'POST') return next(new Err.MethodNotAllowed('Method is not allowed'))
    try {
      validateUploadHeaders(app, req.headers ?? {})
      next()
    } catch (error) {
      next(error)
    }
  }
  const middleware = (req: { feathers: UnknownRecord; file?: unknown }, res: unknown, next: () => void) => {
    req.feathers.file = req.file
    next()
  }

  app.use('/upload', guardUploadRequest, multipartMiddleware.single('uri'), middleware, blob)
  app.service('upload').hooks(getHooks())
}
