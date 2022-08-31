const s = require('../hooks/security')
const Err = require('@feathersjs/errors')
const { hanldeManifestData, handleManifestResponse } = require('../modules/expo/manifest')
const { handleAssetData, handleAssetResponse } = require('../modules/expo/asset')
const { getRequestParams } = require('../modules/expo/request')

class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
    this.throttleTime = app.get('statsThrottle') || 5000
    this.throttleController = {}
  }

  sendReactQueryUpdate (project) {
    this.throttleController[project].lastCall = Date.now()
    this.app.service('messages').create({ action: 'update', keys: [['stats', project]] })
  }

  updateClientsReactQuery (project) {
    if (!this.throttleController[project]) { // Never called an update before, calling now
      this.throttleController[project] = {}
      this.sendReactQueryUpdate(project)
      return true
    }

    const timeSinceLastCall = Date.now() - this.throttleController[project].lastCall

    if (timeSinceLastCall > this.throttleTime) { // Enough time passed, calling now
      this.sendReactQueryUpdate(project)
    } else {
      // Not Enough time passed, debouncing
      clearTimeout(this.throttleController[project].debounce)
      this.throttleController[project].debounce = setTimeout(() => {
        this.sendReactQueryUpdate(project)
      }, this.throttleTime - timeSinceLastCall)
    }
  }

  async clientMetrics (id, { query, headers }) {
    const {
      project,
      platform,
      runtimeVersion,
      releaseChannel
    } = getRequestParams({ query, headers })

    const _id = headers['eas-client-id']
    const embeddedUpdate = headers['expo-embedded-update-id']
    const currentUpdate = headers['expo-current-update-id']
    if (!_id) return false
    const [client] = await this.app.service('clients').find({ query: { _id } })
    if (client) {
      await this.app.service('clients').patch(client._id, {
        lastSeen: new Date().toISOString(),
        version: runtimeVersion,
        embeddedUpdate,
        currentUpdate,
        updateCount: 1 + (client.updateCount || 0)
      })
    } else {
      await this.app.service('clients').create({
        _id: headers['eas-client-id'],
        lastSeen: new Date().toISOString(),
        firstSeen: new Date().toISOString(),
        project,
        version: runtimeVersion,
        platform,
        releaseChannel,
        embeddedUpdate,
        currentUpdate,
        updateCount: 1
      })
    }
    this.updateClientsReactQuery(project)
  }

  async get (id, { query, headers }) {
    if (id === 'manifest') {
      this.clientMetrics(id, { query, headers })
      return hanldeManifestData(this.app, { query, headers })
    }

    if (id === 'assets') return handleAssetData({ query })
    throw new Err.BadRequest('Invalid request.')
  }
}

const apiService = new Service()

module.exports = {
  name: 'api',
  createService: (options) => apiService,
  middleware: (req, res, next) => {
    if (res.data.type === 'manifest') return handleManifestResponse(res)
    if (res.data.type === 'asset') return handleAssetResponse(res)
    next()
  },
  hooks: {
    before: {
      all: [],
      find: [s.methodNotAllowed],
      get: [],
      create: [s.methodNotAllowed],
      update: [s.methodNotAllowed],
      patch: [s.methodNotAllowed],
      remove: [s.methodNotAllowed]
    },
    after: {
      all: [],
      find: [],
      get: [],
      create: [],
      update: [],
      patch: [],
      remove: []
    }
  }
}

module.exports.Service = Service
