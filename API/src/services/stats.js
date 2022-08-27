const s = require('../hooks/security')

class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
  }

  async get (project) {
    const clients = await this.app.service('clients').find({ query: { project } })
    const stats = {}

    clients.forEach(({ version, embeddedUpdate, currentUpdate, updateCount, releaseChannel }) => {
      if (!stats[version]) stats[version] = { embeddedUpdate, updates: {} }
      if (!stats[version].updates[currentUpdate]) stats[version].updates[currentUpdate] = { releaseChannel }
      stats[version].updates[currentUpdate].onThisVersion = (stats[version].updates[currentUpdate].onThisVersion || 0) + 1
      stats[version].updates[currentUpdate].updateRequests = (stats[version].updates[currentUpdate].updateRequests || 0) + (updateCount || 0)
    })
    return Object.entries(stats).map(([version, { updates, embeddedUpdate }]) =>
      ({
        version,
        embeddedUpdate,
        updates: Object.entries(updates).map(
          ([updateId, fields]) =>
            ({
              updateId,
              ...fields
            }))
      }))
  }
}

module.exports = {
  name: 'stats',
  createService: (params) => new Service(params),
  hooks: {
    before: {
      all: s.defaultSecurity(),
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
    }
  }
}
