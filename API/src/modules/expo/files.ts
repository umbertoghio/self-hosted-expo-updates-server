import * as fs from 'fs'
import * as path from 'path'

export const UPDATES_ROOT = '/updates'
const MAX_PATH_LENGTH = 4096

const invalidPath = () => new Error('Invalid update file path')

// Request query values have already been URI-decoded by Express. Never decode
// them a second time; reject ambiguous encodings and traversal before resolve.
export const normalizeUpdatePath = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > MAX_PATH_LENGTH || !value.startsWith(`${UPDATES_ROOT}/`)) {
    throw invalidPath()
  }
  if (/[\\%]/.test(value) || [...value].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)) {
    throw invalidPath()
  }
  const parts = value.slice(1).split('/')
  if (parts.some((part) => !part || part === '.' || part === '..')) throw invalidPath()
  const normalized = path.posix.resolve(value)
  if (!normalized.startsWith(`${UPDATES_ROOT}/`)) throw invalidPath()
  return normalized
}

export const updateFilePath = (uploadPath: unknown, relativeFile: unknown): string => {
  const root = normalizeUpdatePath(uploadPath)
  if (typeof relativeFile !== 'string' || !relativeFile || path.posix.isAbsolute(relativeFile)) throw invalidPath()
  const relative = relativeFile.startsWith('./') ? relativeFile.slice(2) : relativeFile
  return normalizeUpdatePath(`${root}/${relative}`)
}

export const uploadPathFromAsset = (
  asset: unknown,
): { path: string; project: string; version: string; uploadId: string } => {
  const normalized = normalizeUpdatePath(asset)
  const [, , project, version, uploadId, ...file] = normalized.split('/')
  if (!project || !version || !uploadId || !file.length) throw invalidPath()
  return { path: `${UPDATES_ROOT}/${project}/${version}/${uploadId}`, project, version, uploadId }
}

const inside = (root: string, filename: string) => {
  const relative = path.relative(root, filename)
  return !!relative && !relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative)
}

const resolveUpdateFile = (logicalPath: string, updatesRoot: string) => {
  const normalized = normalizeUpdatePath(logicalPath)
  const root = fs.realpathSync(updatesRoot)
  if (!fs.lstatSync(updatesRoot).isDirectory()) throw invalidPath()
  const filename = path.resolve(root, path.posix.relative(UPDATES_ROOT, normalized))
  if (!inside(root, filename)) throw invalidPath()
  let current = root
  const components = path.relative(root, filename).split(path.sep)
  components.forEach((part, index) => {
    current = path.join(current, part)
    const stat = fs.lstatSync(current)
    if (stat.isSymbolicLink() || (index < components.length - 1 && !stat.isDirectory())) throw invalidPath()
  })
  if (fs.realpathSync(filename) !== filename || !fs.lstatSync(filename).isFile()) throw invalidPath()
  return { filename, root }
}

export interface VerifiedUpdateFile {
  path: string
  logicalPath: string
  fd: number
  stat: fs.Stats
}

export const openUpdateFile = (logicalPath: string, updatesRoot = UPDATES_ROOT): VerifiedUpdateFile => {
  const { filename, root } = resolveUpdateFile(logicalPath, updatesRoot)
  const before = fs.lstatSync(filename)
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NONBLOCK | fs.constants.O_NOFOLLOW)
  try {
    const stat = fs.fstatSync(fd)
    const after = fs.lstatSync(filename)
    if (
      !stat.isFile() ||
      stat.dev !== before.dev ||
      stat.ino !== before.ino ||
      stat.dev !== after.dev ||
      stat.ino !== after.ino
    ) {
      throw invalidPath()
    }
    if (fs.realpathSync(filename) !== filename) throw invalidPath()
    // Linux containers expose the actual held descriptor target, so a parent
    // directory rename/symlink cannot redirect the later streaming read.
    if (process.platform === 'linux' && !inside(root, fs.realpathSync(`/proc/self/fd/${fd}`))) throw invalidPath()
    return { path: filename, logicalPath: normalizeUpdatePath(logicalPath), fd, stat }
  } catch (error) {
    fs.closeSync(fd)
    throw error
  }
}

export const readUpdateFile = (logicalPath: string, updatesRoot = UPDATES_ROOT, maxBytes = Infinity): Buffer => {
  const file = openUpdateFile(logicalPath, updatesRoot)
  try {
    if (file.stat.size > maxBytes) throw new Error('Update metadata is too large')
    if (!Number.isFinite(maxBytes)) return fs.readFileSync(file.fd)
    const chunks: Buffer[] = []
    let size = 0
    while (size <= maxBytes) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - size))
      const count = fs.readSync(file.fd, chunk, 0, chunk.length, null)
      if (!count) return Buffer.concat(chunks, size)
      size += count
      if (size > maxBytes) throw new Error('Update metadata is too large')
      chunks.push(chunk.subarray(0, count))
    }
  } finally {
    fs.closeSync(file.fd)
  }
}

export const readUpdateFileAsync = async (
  logicalPath: string,
  updatesRoot = UPDATES_ROOT,
  maxBytes = Infinity,
): Promise<Buffer> => {
  const file = openUpdateFile(logicalPath, updatesRoot)
  try {
    if (file.stat.size > maxBytes) throw new Error('Update metadata is too large')
    if (!Number.isFinite(maxBytes)) {
      return await new Promise((resolve, reject) =>
        fs.readFile(file.fd, (error, data) => (error ? reject(error) : resolve(data))),
      )
    }
    const chunks: Buffer[] = []
    let size = 0
    while (size <= maxBytes) {
      const chunk = Buffer.alloc(Math.min(64 * 1024, maxBytes + 1 - size))
      const count = await new Promise<number>((resolve, reject) =>
        fs.read(file.fd, chunk, 0, chunk.length, null, (error, count) => (error ? reject(error) : resolve(count))),
      )
      if (!count) return Buffer.concat(chunks, size)
      size += count
      if (size > maxBytes) throw new Error('Update metadata is too large')
      chunks.push(chunk.subarray(0, count))
    }
  } finally {
    fs.closeSync(file.fd)
  }
}
