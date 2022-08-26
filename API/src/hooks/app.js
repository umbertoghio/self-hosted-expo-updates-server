
// Application hooks that run for every service
const util = require('util')

const { logger } = require('../modules')

const ignoredCodes = [410, 503, 400, 405, 403, 429, 404]
const ignoredNames = ['NotAuthenticated', 'Conflict']

// Get context Details for Error Log
module.exports.getContextDetails = (context) => {
  const { params = {} } = context
  const errorLog = {}

  context.method && (errorLog.method = context.method)
  context.path && (errorLog.path = context.path)
  context.id && (errorLog.id = context.id)
  context.data && (errorLog.data = context.data)
  params.provider && (errorLog.provider = params.provider)
  params.headers && params.headers['x-forwarded-for'] && (errorLog.ip = params.headers['x-forwarded-for'])
  params.query && Object.keys(params.query).length && (errorLog.query = params.query)
  params.user && Object.keys(params.user).length && (errorLog.user = params.user._id)
  return errorLog
}

const logErrorByCode = ({ code, name }) =>
  ignoredCodes.indexOf(code) > -1 || ignoredNames.indexOf(name) > -1 ? logger.info : logger.error

// Application hooks that run for every service
const log = (context) => {
  logger.debug(`${context.type} app.service('${context.path}').${context.method}()`)

  // Avoid word ERROR in logs for non critical errors
  context.error && logErrorByCode(context.error)(context.error.stack, this.getContextDetails(context))
  if (typeof context.toJSON === 'function') {
    logger.debug('Hook Context', util.inspect(context, { colors: false }))
  }
}

module.exports = {
  before: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  after: {
    all: [],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  },

  error: {
    all: [log],
    find: [],
    get: [],
    create: [],
    update: [],
    patch: [],
    remove: []
  }
}
