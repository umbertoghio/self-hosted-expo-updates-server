const { logger } = require('../modules')
class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
  }

  async get (data) {
    return 'NotFound'
  }

  async find () {
    try {
      const [user] = await this.app.services.users.find({ query: { $limit: 1 } })
      return { ok: !!user }
    } catch (error) {
      logger.error('API - public/status', { error })
    }
    return { ok: false }
  }
}

module.exports = {
  name: 'status',
  createService: (params) => new Service(params),
  hooks: {
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
    }
  }
}
