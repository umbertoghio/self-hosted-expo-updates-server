module.exports = function (app) {
  if (typeof app.channel !== 'function') return false

  app.on('connection', connection => app.channel('anonymous').join(connection))

  app.on('login', (authResult, { connection }) => {
    if (connection) {
      app.channel('anonymous').leave(connection)
      app.channel('authenticated').join(connection)
    }
  })

  app.service('messages').publish('created', (a, { data }) => app.channel('authenticated').send(data))
}
