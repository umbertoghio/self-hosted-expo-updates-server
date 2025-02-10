const MongoClient = require('mongodb').MongoClient

module.exports = function (app) {
  const connection = app.get('mongodb')
  const dbNameEndIndex = connection.includes('?') ? connection.indexOf('?') : connection.length
  const database = connection.substring(connection.lastIndexOf('/') + 1, dbNameEndIndex)
  const mongoClient = MongoClient.connect(connection).then(client => client.db(database))
  app.set('mongoClient', mongoClient)
}
