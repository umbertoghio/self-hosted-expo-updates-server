import * as fs from 'fs'
import * as path from 'path'

import { normalizeUpdatePath, openUpdateFile, readUpdateFileAsync, updateFilePath, UPDATES_ROOT } from './files'
import { getMetadataAsync, getUpdateHashAsync } from './helpers'
import { getLaunchAssetPathAsync } from './patch'

const canAccess = async (p, mode) => {
  try {
    await fs.promises.access(p, mode)
    return true
  } catch (e) {
    return false
  }
}
const isReadable = (p) => canAccess(p, fs.constants.R_OK)
const pathExists = (p) => canAccess(p, fs.constants.F_OK)

/**
 * Inspect a single upload document and return its integrity issues.
 * Issue shape: { severity: 'error' | 'warning', category: string, message: string }
 *
 * All filesystem access is async (libuv threadpool) so this never blocks the
 * main event loop — the asset hot path and admin walks await it.
 *
 * Used by:
 *   - the full project-wide integrity walk (utils.checkIntegrity)
 *   - the pre-flight guard in utils.setRelease
 *   - the asset endpoint patch flow (refuses to serve / queue a patch
 *     for broken bundles)
 *   - the patches worker (refuses to generate patches between broken bundles)
 */
export const checkSingleIntegrity = async (up, updatesRoot = UPDATES_ROOT) => {
  const issues = []
  const err = (category, message) => issues.push({ severity: 'error', category, message })
  const warn = (category, message) => issues.push({ severity: 'warning', category, message })

  if (!up.filename) err('zip', 'zip path not recorded in DB')
  else if (!(await pathExists(up.filename))) err('zip', 'zip archive missing on disk')
  else if (!(await isReadable(up.filename))) err('zip', 'zip archive not readable (permission)')

  let directory = null
  try {
    directory = path.join(updatesRoot, path.posix.relative(UPDATES_ROOT, normalizeUpdatePath(up.path)))
  } catch (e) {
    /* invalid paths are reported as missing directories */
  }
  const hasDir = !!directory && (await pathExists(directory))
  if (!up.path) err('dir', 'extracted path not recorded in DB')
  else if (!hasDir) err('dir', 'extracted directory missing on disk')
  else if (!(await isReadable(directory))) err('dir', 'extracted directory not readable (permission)')

  if (!up.updateId) warn('db', 'updateId missing in DB')
  if (!up.updateHash) warn('db', 'updateHash missing in DB')

  if (hasDir && (await isReadable(directory))) {
    let metadata = null
    try {
      ;({ metadataJson: metadata } = await getMetadataAsync(up, updatesRoot))
    } catch (e) {
      err('metadata', `metadata.json: ${e.message}`)
    }

    try {
      JSON.parse(
        (await readUpdateFileAsync(updateFilePath(up.path, 'app.json'), updatesRoot, 8 * 1024 * 1024)).toString(
          'utf-8',
        ),
      )
    } catch (e) {
      err('app-json', `app.json invalid or unavailable: ${e.message}`)
    }

    try {
      JSON.parse(
        (await readUpdateFileAsync(updateFilePath(up.path, 'package.json'), updatesRoot, 8 * 1024 * 1024)).toString(
          'utf-8',
        ),
      )
    } catch (e) {
      err('package-json', `package.json invalid or unavailable: ${e.message}`)
    }

    if (metadata && up.updateHash) {
      try {
        const computed = await getUpdateHashAsync(up.path, updatesRoot)
        if (computed !== up.updateHash) {
          err('hash', `updateHash drift (db=${up.updateHash.slice(0, 12)}…, fs=${computed.slice(0, 12)}…)`)
        }
      } catch (e) {
        /* metadata read already reported */
      }
    }

    if (metadata?.fileMetadata) {
      for (const platform of ['ios', 'android']) {
        const platMeta = metadata.fileMetadata[platform]
        if (!platMeta) continue

        let bundleFull = null
        try {
          bundleFull = await getLaunchAssetPathAsync(up, platform, updatesRoot)
        } catch (e) {
          err('bundle', `${platform} bundle: ${e.message}`)
        }

        if (bundleFull) {
          try {
            const file = openUpdateFile(bundleFull, updatesRoot)
            fs.closeSync(file.fd)
            if (file.stat.size === 0) err('bundle', `${platform} bundle is empty (0 bytes)`)
          } catch (e) {
            err('bundle', `${platform} bundle invalid or unavailable`)
          }
        }

        const assets = platMeta.assets || []
        const present = assets.map((asset) => {
          try {
            const file = openUpdateFile(updateFilePath(up.path, asset.path), updatesRoot)
            fs.closeSync(file.fd)
            return true
          } catch (e) {
            return false
          }
        })
        const missingAssetCount = present.filter((ok) => !ok).length
        if (missingAssetCount > 0) {
          err('asset', `${platform}: ${missingAssetCount} asset file(s) missing`)
        }
      }
    }
  }

  return {
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  }
}

/**
 * Narrower check: does this upload have an error that would make a launch
 * bundle for the given platform broken? Used by asset/patch flows so we
 * don't fail on iOS issues when an Android client is asking.
 */
export const isLaunchBundleHealthy = async (up, platform, updatesRoot = UPDATES_ROOT) => {
  const { issues } = await checkSingleIntegrity(up, updatesRoot)
  const blocking = issues.filter((i) => {
    if (i.severity !== 'error') return false
    // Categories that affect bundle serving regardless of platform:
    if (['zip', 'dir', 'metadata'].includes(i.category)) return true
    // Bundle category: only block if message mentions our platform.
    if (i.category === 'bundle') return i.message.toLowerCase().includes(platform)
    // Other categories (app-json, package-json, hash, asset) don't break the
    // launch bundle stream itself — clients can still receive bytes.
    return false
  })
  return { healthy: blocking.length === 0, blocking }
}
