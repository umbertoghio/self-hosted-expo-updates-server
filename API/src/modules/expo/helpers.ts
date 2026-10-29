import * as crypto from 'crypto'
import * as fs from 'fs'
import mimeModule from 'mime'
import * as path from 'path'

import type { AssetMetadataOptions, MetadataResult, UnknownRecord, UploadRecord } from '../../types'
import { openUpdateFile, readUpdateFile, readUpdateFileAsync, updateFilePath, UPDATES_ROOT } from './files'

const mime = mimeModule

function createHash(file, hashingAlgorithm, encoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding)
}

function getBase64URLEncoding(base64EncodedString) {
  return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export const convertToDictionaryItemsRepresentation = (
  obj: UnknownRecord,
): Map<string, [unknown, Map<string, unknown>]> => {
  return new Map(Object.entries(obj).map(([k, v]) => [k, [v, new Map()] as [unknown, Map<string, unknown>]]))
}

export const signRSASHA256 = (data, privateKey) => {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data, 'utf8')
  sign.end()
  return sign.sign(privateKey, 'base64')
}

export const getPrivateKeyAsync = async () => {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH
  if (!privateKeyPath) return null

  let pemBuffer: Buffer
  try {
    pemBuffer = fs.readFileSync(path.resolve(privateKeyPath))
    return pemBuffer.toString('utf8')
  } catch (e) {
    return false
  }
}

// Asset files are immutable within an upload, but the manifest endpoint is hit
// by every client on every launch — recomputing sha256+md5 over every asset
// (including the multi-MB launch bundle) on each request blocks the event loop.
// Cache the file-derived hashes keyed by path + size + mtime; the stat guard is
// microseconds vs. reading and hashing megabytes, and invalidates if a path is
// ever reused with different bytes. LRU-capped so memory can't grow unbounded.
const HASH_CACHE_MAX = Number(process.env.ASSET_HASH_CACHE_MAX) || 5000
const hashCache = new Map<string, { hash: string; key: string }>()

const getAssetHashesCached = (logicalPath: string, updatesRoot: string): { hash: string; key: string } => {
  const file = openUpdateFile(logicalPath, updatesRoot)
  try {
    const stat = file.stat
    const cacheKey = `${file.path}:${stat.dev}:${stat.ino}:${stat.size}:${stat.mtimeMs}`
    const hit = hashCache.get(cacheKey)
    if (hit) {
      // Refresh recency: re-insert moves the entry to the end of the Map.
      hashCache.delete(cacheKey)
      hashCache.set(cacheKey, hit)
      return hit
    }
    const asset = fs.readFileSync(file.fd)
    const value = {
      hash: getBase64URLEncoding(createHash(asset, 'sha256', 'base64')),
      key: createHash(asset, 'md5', 'hex'),
    }
    hashCache.set(cacheKey, value)
    if (hashCache.size > HASH_CACHE_MAX) {
      hashCache.delete(hashCache.keys().next().value) // evict least-recently used
    }
    return value
  } finally {
    fs.closeSync(file.fd)
  }
}

export const getAssetMetadataSync = (
  { update, filePath, ext, isLaunchAsset, platform }: AssetMetadataOptions,
  updatesRoot = UPDATES_ROOT,
) => {
  const assetFilePath = updateFilePath(update.path, filePath)
  const { hash: assetHash, key } = getAssetHashesCached(assetFilePath, updatesRoot)
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext)

  const baseUrl = `${process.env.PUBLIC_URL}/api/assets?asset=${assetFilePath}&contentType=${encodeURI(contentType)}&platform=${platform}`
  // Launch assets need to know which (project, updateId) they're being
  // served as so the patch flow on the server can look up patches between
  // the client's currentUpdateId and this one.
  const url = isLaunchAsset
    ? `${baseUrl}&project=${encodeURIComponent(update.project)}&updateId=${encodeURIComponent(update.updateId)}`
    : baseUrl

  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url,
  }
}

// Manifest timestamp prefers releasedAt, but unreleased uploads (and the
// pre-flight integrity guard that runs *before* release) have none — fall back
// to createdAt, then to now, so `new Date(...).toISOString()` never throws
// `RangeError: Invalid Date` and blocks the release. See issue #48.
const resolveManifestTimestamp = (update: UploadRecord): string => {
  for (const candidate of [update.releasedAt, update.createdAt]) {
    if (!candidate) continue
    const d = new Date(candidate)
    if (!Number.isNaN(d.getTime())) return d.toISOString()
  }
  return new Date().toISOString()
}

export const getMetadataSync = (update: UploadRecord, updatesRoot = UPDATES_ROOT): MetadataResult => {
  try {
    const metadataPath = updateFilePath(update.path, 'metadata.json')
    const updateMetadataBuffer = readUpdateFile(metadataPath, updatesRoot, 8 * 1024 * 1024)
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'))

    return {
      metadataJson,
      createdAt: resolveManifestTimestamp(update),
    }
  } catch (error) {
    throw new Error(`No update found with runtime version: ${update.version}. Error: ${error}`)
  }
}

// Async sibling of getMetadataSync. Used by the integrity / admin-walk paths
// that run on the main event loop, so the metadata.json read happens on the
// libuv threadpool instead of blocking. getMetadataSync stays for the manifest
// hot path and the patch worker thread.
export const getMetadataAsync = async (update: UploadRecord, updatesRoot = UPDATES_ROOT): Promise<MetadataResult> => {
  try {
    const metadataPath = updateFilePath(update.path, 'metadata.json')
    const updateMetadataBuffer = await readUpdateFileAsync(metadataPath, updatesRoot, 8 * 1024 * 1024)
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'))
    return {
      metadataJson,
      createdAt: resolveManifestTimestamp(update),
    }
  } catch (error) {
    throw new Error(`No update found with runtime version: ${update.version}. Error: ${error}`)
  }
}

const convertSHA256HashToUUID = (value) => {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`
}

export { convertSHA256HashToUUID }

const getUpdateHash = (pathToUpdate, updatesRoot = UPDATES_ROOT) => {
  const metadataPath = updateFilePath(pathToUpdate, 'metadata.json')
  const updateMetadataBuffer = readUpdateFile(metadataPath, updatesRoot, 8 * 1024 * 1024)
  return createHash(updateMetadataBuffer, 'sha256', 'hex')
}

export { getUpdateHash }

const getUpdateHashAsync = async (pathToUpdate, updatesRoot = UPDATES_ROOT) => {
  const metadataPath = updateFilePath(pathToUpdate, 'metadata.json')
  const updateMetadataBuffer = await readUpdateFileAsync(metadataPath, updatesRoot, 8 * 1024 * 1024)
  return createHash(updateMetadataBuffer, 'sha256', 'hex')
}

export { getUpdateHashAsync }

const getUpdateId = (pathToUpdate, updateHash) => {
  const combined = pathToUpdate + updateHash
  const id = createHash(combined, 'sha256', 'hex')
  return convertSHA256HashToUUID(id)
}

export { getUpdateId }
