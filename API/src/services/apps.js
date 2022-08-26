const s = require('../hooks/security')

const addStats = async (context) => {
  for (let i = 0; i < context.result.length; i++) {
    const uploads = await context.app.service('uploads')
      .find({ query: { project: context.result[i]._id, $sort: { createdAt: -1 } } })

    if (!uploads.length) {
      context.result[i].stats = []
      break
    }

    const stats = await Promise.all(uploads.map(async ({ updateId, version, releaseChannel, status }) => {
      const clients = await context.app.service('clients')
        .find({ query: { currentUpdate: updateId } })
      return ({
        id: updateId,
        version,
        releaseChannel,
        status,
        clients: clients.length
      })
    }))
    context.result[i].stats = stats
  }
  return context
}

module.exports = {
  name: 'apps',
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
      find: [addStats],
      get: [],
      create: [],
      update: [],
      patch: [],
      remove: []
    }
  }
}
