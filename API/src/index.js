// Server Frameworks
const express = require('@feathersjs/express')
const feathers = require('@feathersjs/feathers')

const { feathersconfig, logger } = require('./modules')

// Generation of main Express / FeatherJS Instance
const app = express(feathers())

// FearherJS modules and dependencies configuration
app.configure(feathersconfig(express))

// Server Startup
const server = app.listen(app.get('port'))

const createAdminIfMissing = async () => {
  await new Promise(resolve => setTimeout(resolve, 1000))
  const [admin] = await app.services.users.find({ query: { username: 'admin' } })
  if (!admin) app.services.users.create({ username: 'admin', password: app.get('adminPass'), role: 'admin' })
}
server.on('listening', () => {
  logger.info(`Feathers application started on http://${app.get('host')}:${app.get('port')}`)
  logger.info(`Env: ${process.env.NODE_ENV} DB: ${app.get('mongodb')}`)
  createAdminIfMissing()
})

// Docker support
require('./modules/docker/init')
