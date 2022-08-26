const path = require('path')
const fs = require('fs')
const { Service } = require('feathers-mongodb')
const error = require('../hooks/error')

// Custom service to allow String as _id instead of BsonID
class ServiceNoBsonID extends Service {
  _objectifyId (id) {
    return id
  }
}

// Default Middleware
const defeultMiddleware = (req, res, next) => {
  next()
}

const services = fs
  .readdirSync(path.join(__dirname, '/'))
  .filter((el) => el.includes('.js') && !el.includes('.DS_Store') && el !== 'index.js')
  .map((el) => require(path.join(__dirname, el)))

module.exports = function (app) {
  if (!app) return services

  const defaultOptions = {
    paginate: app.get('paginate'),
    whitelist: ['$regex', '$exists']
  }

  services.forEach((service) => {
    const { name, middleware, noBsonIDs, hooks, createService } = service
    // Custom services with special configuration
    if (!name) {
      app.configure(service)
      return true
    }

    // Service Configuration with custom Class / Middleware or standard MongoDB Service
    if (createService) {
      const createdService = createService(defaultOptions)
      app.use(`/${name}`, createdService, middleware || defeultMiddleware)
    } else {
      const createdService = noBsonIDs ? new ServiceNoBsonID(defaultOptions) : new Service(defaultOptions)
      app.use(`/${name}`, createdService)
      app.get('mongoClient').then((db) => {
        app.service(name).Model = db.collection(name)
      })
    }

    // Hooks Setup
    app.service(name).hooks({ ...hooks, error })
  })
}
