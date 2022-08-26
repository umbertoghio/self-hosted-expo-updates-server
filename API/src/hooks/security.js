const Err = require('@feathersjs/errors')
const { authenticate } = require('@feathersjs/authentication').hooks

const security = {
  isLocal: (context) => !context?.params?.provider,

  defaultSecurity: () => [authenticate('jwt'), security.preventGlobalUpdates],

  // Prevent Method Execution
  methodNotAllowed: (context) => {
    throw new Err.MethodNotAllowed('Method is not allowed')
  },
  // Only Admin can do broad patch / update / delete
  preventGlobalUpdates: (context) => {
    if (security.isLocal(context)) return context
    if (context.method === 'find' || context.method === 'create' || context.method === 'get') return context
    if (!context.id) {
      throw new Err.Forbidden('Global Update Not Authorized: Enitity ID not provided')
    }
    return context
  }
}

module.exports = security
