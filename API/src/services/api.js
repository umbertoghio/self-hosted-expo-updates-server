const s = require('../hooks/security')
const Err = require('@feathersjs/errors')
const { hanldeManifestData, handleManifestResponse } = require('../modules/expo/manifest')
const { handleAssetData, handleAssetResponse } = require('../modules/expo/asset')

class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
  }

  async clientMetrics (id, { query, headers }) {
    const _id = headers['eas-client-id']
    if (!_id) return false
    const [client] = await this.app.service('clients').find({ query: { _id } })
    if (client) {
      this.app.service('clients').patch(client._id, {
        lastSeen: new Date().toISOString(),
        version: headers['expo-runtime-version'],
        embeddedUpdate: headers['expo-embedded-update-id'],
        currentUpdate: headers['expo-current-update-id'],
        updateCount: 1 + (client.updateCount || 0)
      })
    } else {
      this.app.service('clients').create({
        _id: headers['eas-client-id'],
        lastSeen: new Date().toISOString(),
        firstSeen: new Date().toISOString(),
        project: headers['expo-project'],
        version: headers['expo-runtime-version'],
        platform: headers['expo-platform'],
        releaseChannel: headers['expo-channel-name'],
        embeddedUpdate: headers['expo-embedded-update-id'],
        currentUpdate: headers['expo-current-update-id'],
        updateCount: 1
      })
    }
  }

  async get (id, { query, headers }) {
    if (id === 'manifest') {
      await this.clientMetrics(id, { query, headers })
      return hanldeManifestData(this.app, { query, headers })
    }

    if (id === 'assets') return handleAssetData({ query })
    throw new Err.BadRequest('Invalid request.')
  }
}

module.exports = {
  name: 'api',
  createService: (options) => new Service(options),
  middleware: (req, res, next) => {
    if (res.data.type === 'manifest') handleManifestResponse(res)
    if (res.data.type === 'asset') handleAssetResponse(res)
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
