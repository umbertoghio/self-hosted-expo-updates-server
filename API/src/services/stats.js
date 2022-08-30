const s = require('../hooks/security')
const moment = require('moment')
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

    clients.forEach(({ version, platform, embeddedUpdate, currentUpdate, updateCount, releaseChannel, lastSeen }) => {
      const key = `${version}-${platform}-${releaseChannel}`
      if (!stats[key]) stats[key] = { version, platform, releaseChannel, embeddedUpdate, updates: {} }
      if (!stats[key].updates[currentUpdate]) stats[key].updates[currentUpdate] = { onThisVersion: 0, updateRequests: 0, lastSeen, isBuild: currentUpdate === embeddedUpdate }
      stats[key].updates[currentUpdate].onThisVersion++
      stats[key].updates[currentUpdate].updateRequests += (updateCount || 0)
      if (moment(lastSeen).isAfter(stats[key].updates[currentUpdate].lastSeen)) stats[key].updates[currentUpdate].lastSeen = lastSeen
    })

    const result = Object.values(stats).map(({ updates, ...rest }) => ({
      ...rest,
      updates: Object.entries(updates).map(([updateId, fields]) => ({
        updateId,
        ...fields
      }))
    })).sort((a, b) => a.version > b.version)

    return result
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
