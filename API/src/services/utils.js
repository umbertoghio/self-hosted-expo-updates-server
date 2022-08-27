const s = require('../hooks/security')
const Err = require('@feathersjs/errors')
const { generateSelfSigned } = require('../modules/expo/certs')
const fs = require('fs')

class Service {
  constructor (options) {
    this.options = options || {}
  }

  setup (app) {
    this.app = app
  }

  async setRelease ({ uploadId }) {
    if (!uploadId) throw new Err.BadRequest('Missing uploadId or path')

    const upload = await this.app.service('uploads').get(uploadId)
    if (!upload) throw new Err.NotFound('Upload not found')

    const uploads = await this.app.service('uploads').find({ query: { project: upload.project, version: upload.version, releaseChannel: upload.releaseChannel } })

    await Promise.all(uploads.map(upd =>
      this.app.service('uploads').patch(upd._id, {
        status: upd._id.toString() === upload._id.toString() ? 'released' : (upd.status === 'ready' ? 'ready' : 'obsolete'),
        releasedAt: upd._id.toString() === upload._id.toString() ? new Date().toISOString() : null
      })
    ))
    return { message: 'Update Set' }
  }

  async deleteRelease ({ uploadId }) {
    if (!uploadId) throw new Err.BadRequest('Missing uploadId or path')

    const upload = await this.app.service('uploads').get(uploadId)
    if (!upload) throw new Err.NotFound('Upload not found')

    fs.rmSync(upload.path, { recursive: true, force: true })
    fs.rmSync(upload.filename, { force: true })

    await this.app.service('uploads').remove(upload._id)

    return { message: 'Update Deleted' }
  }

  async update (id, data) {
    if (id === 'release') return this.setRelease(data)
    if (id === 'delete') return this.deleteRelease(data)

    throw new Err.BadRequest('Invalid request.')
  }

  async get (id, params) {
    if (id === 'generateSelfSigned') return generateSelfSigned()
    if (id === 'getUploadKey') return ({ uploadKey: this.app.get('uploadKey') })
    throw new Err.BadRequest('Invalid request.')
  }
}

module.exports = {
  name: 'utils',
  createService: (options) => new Service(options),
  hooks: {
    before: {
      all: s.defaultSecurity(),
      find: [s.methodNotAllowed],
      get: [],
      create: [s.methodNotAllowed],
      update: [],
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
