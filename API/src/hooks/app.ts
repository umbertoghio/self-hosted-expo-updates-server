// Application hooks that run for every service
import * as util from 'util'

import { logger } from '../modules'
import type { HookContextLike, UnknownRecord } from '../types'

const ignoredCodes = [410, 503, 400, 405, 403, 429, 404]
const ignoredNames = ['NotAuthenticated', 'Conflict']

// Log copies only; credentials in the live hook context must remain untouched.
const redactLogFields = (value: unknown, seen = new WeakSet<object>(), depth = 0): unknown => {
  if (value === null || typeof value !== 'object') return value
  if (depth > 8) return '[Truncated]'
  if (seen.has(value)) return '[Circular]'
  seen.add(value)
  if (Array.isArray(value)) return value.map((item) => redactLogFields(item, seen, depth + 1))
  if (value instanceof Date) return value.toISOString()
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [
      key,
      /password|token|authorization|uploadkey|privatekey/i.test(key.replace(/[-_]/g, ''))
        ? '[REDACTED]'
        : redactLogFields(item, seen, depth + 1),
    ]),
  )
}

// Get context Details for Error Log
const getContextDetails = (context: HookContextLike) => {
  const { params = {} } = context
  const errorLog: UnknownRecord = {}

  context.method && (errorLog.method = context.method)
  context.path && (errorLog.path = context.path)
  context.id && (errorLog.id = context.id)
  context.data && (errorLog.data = context.data)
  params.provider && (errorLog.provider = params.provider)
  params.headers && params.headers['x-forwarded-for'] && (errorLog.ip = params.headers['x-forwarded-for'])
  params.query && Object.keys(params.query).length && (errorLog.query = params.query)
  params.user && Object.keys(params.user).length && (errorLog.user = params.user._id)
  return redactLogFields(errorLog) as UnknownRecord
}

export { getContextDetails }

const logErrorByCode = ({ code, name }: { code?: number; name?: string }) =>
  ignoredCodes.indexOf(code) > -1 || ignoredNames.indexOf(name) > -1 ? logger.info : logger.error

// Application hooks that run for every service
const log = (context: HookContextLike) => {
  logger.debug(`${context.type} app.service('${context.path}').${context.method}()`)

  // Avoid word ERROR in logs for non critical errors
  context.error && logErrorByCode(context.error)(context.error.stack, getContextDetails(context))
  if (typeof context.toJSON === 'function') {
    logger.debug('Hook Context', util.inspect(getContextDetails(context), { colors: false }))
  }
}

export default {
  before: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },

  error: {
    all: [log],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: [],
  },
}
