const configuration = require('@feathersjs/configuration')
const socketio = require('@feathersjs/socketio')

const expressconfig = require('./express.config')
const logger = require('./logger')

module.exports = (express) => (app) => {
  // Load Feathers configuration
  app.configure(configuration())

  // Load Express configuration
  app.configure(expressconfig(express))

  // Set up Providers
  app.configure(express.rest())
  app.configure(socketio({ cookie: false }))

  // Database Adapter
  app.configure(require('./mongodb'))

  // SConfiguring Services
  app.configure(require('../services'))

  // Setting up Feathres Services and Hooks
  app.configure(require('./channels'))
  app.hooks(require('../hooks/app'))

  // Configure a middleware for 404s and the error handler
  app.use(express.notFound())
  app.use(express.errorHandler({ logger }))
}
