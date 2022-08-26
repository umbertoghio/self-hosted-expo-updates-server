const s = require('../hooks/security')
const { hashPassword, protect } = require('@feathersjs/authentication-local').hooks

module.exports = {
  name: 'users',
  hooks: {
    before: {
      all: s.defaultSecurity(),
      find: [],
      get: [],
      create: [hashPassword('password')],
      update: [hashPassword('password')],
      patch: [hashPassword('password')],
      remove: []
    },

    after: {
      all: [protect('password')],
      find: [],
      get: [],
      create: [],
      update: [],
      patch: [],
      remove: []
    }
  }
}
