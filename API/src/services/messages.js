const s = require('../hooks/security')

class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
  }

  async create (data, params) {
    return 'OK'
  }
}

module.exports = {
  name: 'messages',
  createService: (options) => new Service(options),
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

module.exports.Service = Service
