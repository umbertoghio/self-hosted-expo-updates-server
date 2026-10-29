import * as Err from '@feathersjs/errors'
import * as fs from 'fs'

import { getBsdiffSettings } from '../../services/bsdiff-settings'
import type { LoggerLike } from '../../types'
import loggerDefault from '../logger'
import {
  normalizeUpdatePath,
  openUpdateFile,
  readUpdateFile,
  updateFilePath,
  UPDATES_ROOT,
  type VerifiedUpdateFile,
} from './files'
import { isLaunchBundleHealthy } from './integrity'
import { getLaunchAssetPathAsync, getPatchFilePath } from './patch'
import { findPublishedAsset, isPublishedUpload } from './published-asset'
const logger: LoggerLike = loggerDefault

const PATCH_TERMINAL_NOT_BENEFICIAL = 'not-beneficial'
const PATCH_TERMINAL_READY = 'ready'
const PATCH_IN_PROGRESS = ['pending', 'generating', 'validating']

const wantsBsdiffPatch = (headers) => {
  const aIm = headers['a-im'] || headers['A-IM']
  if (!aIm) return false
  return String(aIm)
    .split(',')
    .map((v) => v.trim().toLowerCase())
    .includes('bsdiff')
}

const buildFallback = (assetPath, contentType) => ({
  type: 'asset',
  path: assetPath,
  contentType,
})

/**
 * Decide whether to serve a bsdiff patch for this launch-asset request.
 *
 * Returns one of:
 *   { decision: 'serve-patch', patchDoc }
 *   { decision: 'mark-failed-then-fallback', patchDoc, reason }  // file missing
 *   { decision: 'queue-then-fallback', insertDoc }                // no record yet
 *   { decision: 'reset-then-fallback', patchDoc }                 // failed past cooldown
 *   { decision: 'fallback' }                                      // any other case
 *
 * Status semantics:
 *   - 'ready' + file exists      → serve
 *   - 'ready' + file missing     → mark failed (cooldown) → fallback
 *   - 'not-beneficial'           → terminal, never serve, never retry
 *   - 'pending'/'generating'/'validating' → worker busy → fallback
 *   - 'failed' + cooldown done   → reset to pending → fallback
 *   - 'failed' + still cooling   → fallback
 *   - no record                  → enqueue → fallback
 */
const decidePatchAction = (existing, now, fileExists: (filename: string) => boolean = fs.existsSync) => {
  if (!existing) {
    return { decision: 'queue-then-fallback' }
  }
  if (existing.status === PATCH_TERMINAL_READY) {
    if (existing.path && fileExists(existing.path)) {
      return { decision: 'serve-patch', patchDoc: existing }
    }
    return {
      decision: 'mark-failed-then-fallback',
      patchDoc: existing,
      reason: `patch file missing at ${existing.path}`,
    }
  }
  if (existing.status === PATCH_TERMINAL_NOT_BENEFICIAL) {
    return { decision: 'fallback' }
  }
  if (PATCH_IN_PROGRESS.includes(existing.status)) {
    return { decision: 'fallback' }
  }
  if (existing.status === 'failed') {
    const cooldownDone = !existing.nextAttemptAt || new Date(existing.nextAttemptAt) <= now
    if (cooldownDone) return { decision: 'reset-then-fallback', patchDoc: existing }
    return { decision: 'fallback' }
  }
  return { decision: 'fallback' }
}

const isLaunchAssetPath = async (assetPath, upload, platform, updatesRoot) => {
  try {
    const expected = await getLaunchAssetPathAsync(upload, platform, updatesRoot)
    return normalizeUpdatePath(assetPath) === expected
  } catch (e) {
    return false
  }
}

const tryHandlePatch = async (app, { query, headers }, fallback, authorizedUpload, updatesRoot) => {
  const { asset, project, platform, updateId } = query
  if (!wantsBsdiffPatch(headers)) return fallback
  if (!project || !platform || !updateId) return fallback
  if (platform !== 'ios' && platform !== 'android') return fallback

  const currentUpdateId = headers['expo-current-update-id'] || headers['Expo-Current-Update-ID']
  const requestedUpdateId = headers['expo-requested-update-id'] || headers['Expo-Requested-Update-ID']
  if (!currentUpdateId || !requestedUpdateId) return fallback
  if (currentUpdateId.toLowerCase() === requestedUpdateId.toLowerCase()) return fallback

  // Per-app toggle
  let application
  try {
    application = await app.service('apps').get(project)
  } catch (e) {
    return fallback
  }
  if (!application?.bsdiffEnabled) return fallback

  // Resolve uploads
  let toUpload, fromUpload
  try {
    const [toMatches, fromMatches] = await Promise.all([
      app.service('uploads').find({ query: { updateId: requestedUpdateId, $limit: 1 } }),
      app.service('uploads').find({ query: { updateId: currentUpdateId, $limit: 1 } }),
    ])
    toUpload = toMatches?.[0] || toMatches?.data?.[0]
    fromUpload = fromMatches?.[0] || fromMatches?.data?.[0]
  } catch (e) {
    logger.warn('asset.patch: upload lookup failed', { error: e.message })
    return fallback
  }
  if (!toUpload || !fromUpload) return fallback
  if (!isPublishedUpload(toUpload) || !isPublishedUpload(fromUpload)) return fallback
  if (toUpload.path !== authorizedUpload.path || toUpload.updateId !== authorizedUpload.updateId) return fallback

  // Cross-version safety
  if (toUpload.project !== project) return fallback
  if (toUpload.project !== fromUpload.project) return fallback
  if (toUpload.version !== fromUpload.version) return fallback
  if (toUpload.releaseChannel !== fromUpload.releaseChannel) return fallback

  // Verify the requested asset is actually the launch bundle of toUpload
  if (!(await isLaunchAssetPath(asset, toUpload, platform, updatesRoot))) return fallback

  // Integrity gate — never serve or queue patches based on broken bundles.
  // We check both ends because:
  //   - if the FROM bundle is broken, our generated patch would diff against
  //     corrupt input → server-side hash mismatch on validation, or worse,
  //     a syntactically valid but semantically wrong patch.
  //   - if the TO bundle is broken, the patch would reconstruct corrupt
  //     output, which the client would reject (or worse, accept).
  const fromHealth = await isLaunchBundleHealthy(fromUpload, platform, updatesRoot)
  if (!fromHealth.healthy) {
    logger.warn('asset.patch: skipping — FROM bundle has integrity errors', {
      fromUpdateId: currentUpdateId,
      blocking: fromHealth.blocking.map((b) => b.message),
    })
    return fallback
  }
  const toHealth = await isLaunchBundleHealthy(toUpload, platform, updatesRoot)
  if (!toHealth.healthy) {
    logger.warn('asset.patch: skipping — TO bundle has integrity errors', {
      toUpdateId: requestedUpdateId,
      blocking: toHealth.blocking.map((b) => b.message),
    })
    return fallback
  }

  const patches = app.service('patches')
  const now = new Date()

  let existing = null
  try {
    const found = await patches.find({
      query: {
        fromUpdateId: currentUpdateId,
        toUpdateId: requestedUpdateId,
        platform,
        $limit: 1,
      },
    })
    existing = found?.[0] || found?.data?.[0] || null
  } catch (e) {
    logger.warn('asset.patch: patches lookup failed', { error: e.message })
    return fallback
  }

  const decision = decidePatchAction(existing, now, (filePath) => {
    try {
      const file = openUpdateFile(filePath, updatesRoot)
      fs.closeSync(file.fd)
      return true
    } catch (e) {
      return false
    }
  })

  if (decision.decision === 'serve-patch') {
    // A DB path is not authority to read an arbitrary file. It must be the
    // deterministic patch for this pair, and pass the same FD jail as assets.
    if (normalizeUpdatePath(decision.patchDoc.path) !== getPatchFilePath(toUpload, fromUpload, platform))
      return fallback
    // increment served count via raw $inc (Feathers patch doesn't support operators)
    if (patches.Model) {
      patches.Model.updateOne(
        { _id: decision.patchDoc._id },
        { $inc: { servedCount: 1 }, $set: { lastServedAt: now } },
      ).catch((e) => logger.warn('asset.patch: servedCount inc failed', { error: e.message }))
    }
    return {
      type: 'patch',
      path: decision.patchDoc.path,
      baseUpdateId: currentUpdateId,
    }
  }

  if (decision.decision === 'mark-failed-then-fallback') {
    logger.warn('asset.patch: ready patch file missing, marking failed', {
      id: decision.patchDoc._id,
      reason: decision.reason,
    })
    const { cooldownMs } = await getBsdiffSettings(app)
    patches
      .patch(
        decision.patchDoc._id,
        {
          status: 'failed',
          error: decision.reason,
          nextAttemptAt: new Date(now.getTime() + cooldownMs),
          path: null,
        },
        {
          reason: 'asset request: ready patch file missing on disk; marked failed for cooldown then regeneration',
        },
      )
      .catch((e) => logger.warn('asset.patch: failed to mark failed', { error: e.message }))
    return fallback
  }

  if (decision.decision === 'reset-then-fallback') {
    patches
      .patch(
        decision.patchDoc._id,
        {
          status: 'pending',
          nextAttemptAt: now,
          error: null,
        },
        {
          reason: 'asset request: failed cooldown elapsed; queued for retry',
        },
      )
      .catch((e) => logger.warn('asset.patch: failed to reset to pending', { error: e.message }))
    return fallback
  }

  if (decision.decision === 'queue-then-fallback') {
    patches
      .create({
        project,
        platform,
        version: toUpload.version,
        releaseChannel: toUpload.releaseChannel,
        fromUpdateId: currentUpdateId,
        toUpdateId: requestedUpdateId,
        fromUploadId: fromUpload._id,
        toUploadId: toUpload._id,
        status: 'pending',
        attempts: 0,
        servedCount: 0,
        createdAt: now,
        nextAttemptAt: now,
      })
      .catch((e) => {
        // unique-index violation = someone else already enqueued; safe to ignore
        if (e?.code !== 11000 && !String(e?.message || '').includes('duplicate key')) {
          logger.warn('asset.patch: enqueue failed', { error: e.message })
        }
      })
    return fallback
  }

  return fallback
}

export const handleAssetData = async (app, { query, headers = {} }, updatesRoot = UPDATES_ROOT) => {
  const { asset, contentType } = query
  if (!asset || !contentType) {
    throw new Err.BadRequest('No asset or contentType provided.')
  }

  let authorized
  try {
    authorized = await findPublishedAsset(app, { query, headers }, updatesRoot)
  } catch (e) {
    throw new Err.BadRequest('Invalid or unpublished asset.')
  }
  const fallback = buildFallback(authorized.assetPath, authorized.contentType)
  let result = fallback
  try {
    result = await tryHandlePatch(app, { query, headers }, fallback, authorized.upload, updatesRoot)
  } catch (e) {
    logger.error('asset.patch: unexpected error, falling back to full bundle', { error: e.message })
  }
  try {
    const file = openUpdateFile(result.path, updatesRoot)
    fs.closeSync(file.fd)
    // Feathers also exposes this service via socket.io. Never leave an open
    // descriptor in service results; only the HTTP response owns a stream.
    return result
  } catch (e) {
    throw new Err.BadRequest('Asset file is unavailable.')
  }
}

// Stream a file from disk instead of buffering it whole with readFileSync.
// readFileSync blocks the single-threaded event loop for the entire read —
// under concurrent clients pulling multi-MB bundles/patches that serialises
// every request. createReadStream + pipe is async with backpressure, so the
// loop stays free and memory stays bounded.
const streamAssetFile = (
  res,
  file: VerifiedUpdateFile,
  { status, contentType, headers }: { status?: number; contentType: string; headers?: Record<string, string> },
) => {
  // Phase A — before any byte is written we can still send a clean status.
  let stream: fs.ReadStream
  try {
    if (!file || !fs.fstatSync(file.fd).isFile()) throw new Error('Invalid asset descriptor')
    // With fd supplied Node/Bun never opens this path again. Ownership of the
    // already verified descriptor transfers to the stream, including aborts.
    stream = fs.createReadStream(file.path, { fd: file.fd, autoClose: true })
    if (status) res.status(status)
    if (headers) {
      for (const [key, value] of Object.entries(headers)) res.set(key, value)
    }
    res.type(contentType)
    res.set('Content-Length', String(file.stat.size))
  } catch (e) {
    if (stream) stream.destroy()
    else if (file) fs.closeSync(file.fd)
    logger.error('asset.stream: setup failed before send', { error: e.message })
    if (!res.headersSent) res.status(404).end()
    return
  }

  // Phase B — headers may already be flushed, so the status is locked in.
  // The only honest signal left is to destroy the connection; the Expo client
  // detects the truncated/aborted download (size/hash mismatch) and retries.
  stream.on('error', (e) => {
    logger.error('asset.stream: read error mid-stream', { path: file.path, error: e.message })
    if (!res.headersSent) {
      res.status(404).end()
    } else {
      res.destroy()
    }
  })
  // Client aborted the download — close the fd so it isn't leaked under load.
  res.on('close', () => stream.destroy())
  stream.pipe(res)
}

export const handleAssetResponse = (res, updatesRoot = UPDATES_ROOT) => {
  let file: VerifiedUpdateFile
  try {
    // Revalidate and hold the actual response descriptor. The stream below
    // uses this FD, so no path is reopened after the security check.
    file = openUpdateFile(res.data.path, updatesRoot)
  } catch (error) {
    if (!res.headersSent) res.status(404).end()
    else res.destroy()
    return
  }
  if (res.data.type === 'patch') {
    streamAssetFile(res, file, {
      status: 226,
      contentType: 'application/octet-stream',
      headers: { IM: 'bsdiff', 'expo-base-update-id': res.data.baseUpdateId },
    })
    return
  }
  streamAssetFile(res, file, { contentType: res.data.contentType })
}

export const getJSONInfo = ({ path: paramPath }, updatesRoot = UPDATES_ROOT) => {
  if (!paramPath) throw new Err.BadRequest('Missing path parameter')

  const appJsonBuffer = readUpdateFile(updateFilePath(paramPath, 'app.json'), updatesRoot, 8 * 1024 * 1024)
  const appJson = JSON.parse(appJsonBuffer.toString('utf-8'))

  const pkgJsonBuffer = readUpdateFile(updateFilePath(paramPath, 'package.json'), updatesRoot, 8 * 1024 * 1024)
  const pkgJson = JSON.parse(pkgJsonBuffer.toString('utf-8'))
  return {
    appJson: appJson.expo,
    dependencies: pkgJson.dependencies,
  }
}

export { decidePatchAction }
