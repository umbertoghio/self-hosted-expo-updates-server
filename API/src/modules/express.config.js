// Module Dependencies
const path = require('path')

const favicon = require('serve-favicon')
const compress = require('compression')
const helmet = require('helmet')
const cors = require('cors')

const addWebhookRawBody = (req, res, buf) => { req.url && req.url === '/webhooks' && (req.rawBody = buf) }

module.exports = (express) => (app) => {
  // Enable security, CORS, compression, favicon and body parsing
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use(cors())
  app.use(compress())
  app.use(express.json({ limit: '20mb', verify: addWebhookRawBody }))
  app.use(express.urlencoded({ extended: true, limit: '5mb' }))

  // Host the public folder and Favicon
  app.use('/', express.static(app.get('public')))
  app.use(favicon(path.join(app.get('public'), 'favicon.ico')))
}
