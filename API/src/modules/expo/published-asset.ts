import mime from 'mime'

import type { UploadRecord } from '../../types'
import { normalizeUpdatePath, updateFilePath, UPDATES_ROOT, uploadPathFromAsset } from './files'
import { getMetadataAsync } from './helpers'

export const isPublishedUpload = (upload: UploadRecord) =>
  !!upload && ['released', 'obsolete'].includes(upload.status) && !upload.deletedAt

// Asset URLs emitted by older manifests contain only asset/contentType/platform.
// Identify the one upload from its immutable directory, then allow only files
// listed for that platform. Never walk all uploads or expose arbitrary files.
export const findPublishedAsset = async (app, { query, headers = {} }, updatesRoot = UPDATES_ROOT) => {
  const assetPath = normalizeUpdatePath(query.asset)
  const target = uploadPathFromAsset(assetPath)
  const platform = query.platform ?? headers['expo-platform']
  if (platform !== 'ios' && platform !== 'android') throw new Error('Invalid asset platform')
  const project = query.project ?? headers['expo-project']
  const version = query.version ?? headers['expo-runtime-version']
  if (project !== undefined && project !== target.project) throw new Error('Asset project mismatch')
  if (version !== undefined && version !== target.version) throw new Error('Asset runtime mismatch')

  const matches = await app.service('uploads').find({
    query: {
      _id: target.uploadId,
      path: target.path,
      project: target.project,
      version: target.version,
      status: { $in: ['released', 'obsolete'] },
      $limit: 2,
    },
  })
  const uploads = Array.isArray(matches) ? matches : matches?.data
  if (!Array.isArray(uploads) || uploads.length !== 1) throw new Error('Published upload not found')
  const upload: UploadRecord = uploads[0]
  if (
    !isPublishedUpload(upload) ||
    String(upload._id) !== target.uploadId ||
    upload.path !== target.path ||
    upload.project !== target.project ||
    upload.version !== target.version ||
    (query.updateId !== undefined && query.updateId !== upload.updateId)
  )
    throw new Error('Published upload mismatch')

  const { metadataJson } = await getMetadataAsync(upload, updatesRoot)
  const metadata = metadataJson?.fileMetadata?.[platform]
  if (!metadata || !Array.isArray(metadata.assets)) throw new Error('Asset platform not found')
  // Operational metadata must never become downloadable through a malformed
  // bundle/asset entry, even if an upload accidentally lists it.
  const reserved = ['metadata.json', 'app.json', 'package.json']
  const relativePath = assetPath.slice(target.path.length + 1)
  if (reserved.includes(relativePath)) throw new Error('Private upload metadata')
  if (metadata.bundle && updateFilePath(upload.path, metadata.bundle) === assetPath) {
    return { upload, platform, assetPath, contentType: 'application/javascript' }
  }
  for (const asset of metadata.assets) {
    if (updateFilePath(upload.path, asset.path) === assetPath) {
      return { upload, platform, assetPath, contentType: mime.getType(asset.ext || '') || 'application/octet-stream' }
    }
  }
  throw new Error('Asset is not part of the published update')
}
