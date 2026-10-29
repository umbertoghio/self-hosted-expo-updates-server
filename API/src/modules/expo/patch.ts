import * as crypto from 'crypto'
import * as fs from 'fs'
import * as path from 'path'

import { updateFilePath, UPDATES_ROOT } from './files'
import { getMetadataAsync, getMetadataSync } from './helpers'

const PATCH_BENEFIT_RATIO = 0.75
const PATCH_DIR_NAME = '_patches'
// Our vendored fork of @hot-updater/bsdiff (API/vendor/bsdiff) emits the
// classic 8-byte "BSDIFF40" magic — the format expo-updates' on-device
// bspatch.c hard-requires (memcmp "BSDIFF40", 32-byte header, three bzip2
// streams). The upstream npm package emits ENDSLEY/BSDIFF43, which the client
// cannot apply; see API/vendor/bsdiff/README.md.
const BSDIFF_MAGIC = Buffer.from('BSDIFF40', 'utf8')

let hdiffPromise = null
const loadHdiff = () => {
  if (!hdiffPromise) {
    // @hot-updater/bsdiff is ESM-only; load it via dynamic import from CommonJS.
    hdiffPromise = import('@hot-updater/bsdiff').then((m) => m.hdiff)
  }
  return hdiffPromise
}

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest('hex')

export const getLaunchAssetPath = (upload, platform, updatesRoot = UPDATES_ROOT) => {
  const { metadataJson } = getMetadataSync(upload, updatesRoot)
  const platformMeta = metadataJson?.fileMetadata?.[platform]
  if (!platformMeta?.bundle) {
    throw new Error(`No bundle for platform ${platform} in update ${upload.updateId}`)
  }
  return updateFilePath(upload.path, platformMeta.bundle)
}

// Async sibling for main-loop callers (integrity guard, asset hot path, admin
// size walk). The sync version stays for the patch worker thread.
export const getLaunchAssetPathAsync = async (upload, platform, updatesRoot = UPDATES_ROOT) => {
  const { metadataJson } = await getMetadataAsync(upload, updatesRoot)
  const platformMeta = metadataJson?.fileMetadata?.[platform]
  if (!platformMeta?.bundle) {
    throw new Error(`No bundle for platform ${platform} in update ${upload.updateId}`)
  }
  return updateFilePath(upload.path, platformMeta.bundle)
}

// Which platforms this upload ships a launch bundle for. Used by the manual
// patch-enqueue flow to compute the from↔to platform intersection (a patch
// is only meaningful when both updates have a bundle for that platform).
export const getAvailablePlatforms = (upload): string[] => {
  try {
    const { metadataJson } = getMetadataSync(upload)
    const fm = metadataJson?.fileMetadata || {}
    // android first, then ios — drives the manual-enqueue creation order.
    return ['android', 'ios'].filter((p) => fm[p]?.bundle)
  } catch (e) {
    return []
  }
}

export const getPatchDir = (toUpload) => updateFilePath(toUpload.path, PATCH_DIR_NAME)

export const getPatchFilePath = (toUpload, fromUpload, platform) =>
  updateFilePath(getPatchDir(toUpload), `from-${fromUpload.updateId}-${platform}.patch`)

const ensurePatchDir = (toUpload) => {
  const dir = getPatchDir(toUpload)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

export const generatePatch = async (fromUpload, toUpload, platform) => {
  const fromPath = getLaunchAssetPath(fromUpload, platform)
  const toPath = getLaunchAssetPath(toUpload, platform)
  if (!fs.existsSync(fromPath)) throw new Error(`Base bundle missing: ${fromPath}`)
  if (!fs.existsSync(toPath)) throw new Error(`Target bundle missing: ${toPath}`)

  const fromBuf = fs.readFileSync(fromPath)
  const toBuf = fs.readFileSync(toPath)

  const hdiff = await loadHdiff()
  const patchBytes = await hdiff(fromBuf, toBuf)
  // @hot-updater/bsdiff returns a Uint8Array-like; ensure Buffer for fs.write
  const patchBuf = Buffer.isBuffer(patchBytes) ? patchBytes : Buffer.from(patchBytes.buffer || patchBytes)

  ensurePatchDir(toUpload)
  const outPath = getPatchFilePath(toUpload, fromUpload, platform)
  // Write to a unique temp file, then atomically rename into place. If two
  // workers ever generate the same patch concurrently (e.g. a slow job exceeds
  // the stale-reclaim window, or multiple API instances), neither can observe
  // a half-written file: rename is atomic on the same filesystem, and bsdiff is
  // deterministic so both produce byte-identical output — last rename wins.
  const tmpPath = `${outPath}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2)}.tmp`
  try {
    fs.writeFileSync(tmpPath, patchBuf)
    fs.renameSync(tmpPath, outPath)
  } catch (e) {
    try {
      fs.unlinkSync(tmpPath)
    } catch (cleanupErr) {
      /* tmp may not exist */
    }
    throw e
  }

  return {
    path: outPath,
    size: patchBuf.length,
    targetSize: toBuf.length,
    targetHash: sha256(toBuf),
    fromHash: sha256(fromBuf),
  }
}

/**
 * Server-side validation of a freshly generated patch.
 *
 * Strategy (no server-side apply — see docs/bsdiff-architecture.md):
 * 1. Magic header check — patch must start with BSDIFF40 (the format both
 *    iOS bspatch.c and Android BSPatch.cpp expect).
 * 2. Non-empty body.
 * 3. Benefit check — patch.length < 0.75 * target.length, else patch wastes
 *    client CPU/battery for negligible network savings → terminal `not-beneficial`.
 *
 * Final correctness (sha256 of patched output == target hash) is enforced by
 * the native client (see expo-updates FileDownloader iOS/Android), which
 * auto-falls back to a full download on mismatch. Duplicating that on the
 * server is dead work.
 */
export const validatePatch = async ({ patchPath, expectedTargetSize, benefitRatio = PATCH_BENEFIT_RATIO }) => {
  let patchBuf
  try {
    patchBuf = fs.readFileSync(patchPath)
  } catch (e) {
    return { ok: false, reason: `failed to read patch file: ${e.message}` }
  }

  if (patchBuf.length < BSDIFF_MAGIC.length) {
    return { ok: false, reason: `patch too small (${patchBuf.length} bytes)` }
  }
  if (!patchBuf.subarray(0, BSDIFF_MAGIC.length).equals(BSDIFF_MAGIC)) {
    return {
      ok: false,
      reason: `magic mismatch: expected BSDIFF40 header`,
    }
  }

  const actualRatio = patchBuf.length / expectedTargetSize
  if (actualRatio >= benefitRatio) {
    return {
      ok: false,
      reason: `not-beneficial: patch is ${(actualRatio * 100).toFixed(1)}% of target (threshold ${(benefitRatio * 100).toFixed(1)}%)`,
      notBeneficial: true,
    }
  }

  return { ok: true }
}

export const deletePatchFile = (patchPath) => {
  if (patchPath && fs.existsSync(patchPath)) {
    try {
      fs.unlinkSync(patchPath)
    } catch (e) {
      // best-effort; file may already be gone
    }
  }
}

export const sumPatchesSize = (toUpload) => {
  const dir = getPatchDir(toUpload)
  if (!fs.existsSync(dir)) return 0
  let total = 0
  for (const entry of fs.readdirSync(dir)) {
    try {
      total += fs.statSync(path.join(dir, entry)).size
    } catch (e) {
      /* ignore */
    }
  }
  return total
}

export { PATCH_BENEFIT_RATIO, PATCH_DIR_NAME, sha256 }
