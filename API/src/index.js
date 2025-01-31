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
  try {
    if (!process.env.MONGO_CONN) throw new Error('MONGO_CONN not defined, please run this server under docker compose or set MONGO_CONN env variable')
    const [admin] = await app.services.users.find({ query: { username: 'admin' } })
    if (!admin) app.services.users.create({ username: 'admin', password: app.get('adminPass'), role: 'admin' })
  } catch (e) {
    logger.error(e.message)
    logger.error('Error creating admin user, please try to restart API server or verify Mongodb connection.', e)
  }
}
server.on('listening', () => {
  logger.info(`Feathers application started on http://${app.get('host')}:${app.get('port')}`)
  logger.info(`Env: ${process.env.NODE_ENV} DB: ${app.get('mongodb')}`)
  setTimeout(createAdminIfMissing, 3000)
})

// Docker support
require('./modules/docker/init')
