const { hanldeManifestData } = require('./manifest')
const { handleAssetData } = require('./asset')

const { clientMetrics } = require('./metrics')

module.exports = (app) => {
  // Don't update clients more ofthen than this time
  const throttleTime = app.get('statsThrottle') || 5000

  return ({ path, query, headers }, res) => {
    if (path.includes('manifest')) {
      clientMetrics({ app, throttleTime, query, headers })
      return hanldeManifestData(app, { query, headers }, res)
    }
    if (path.includes('assets')) {
      return handleAssetData(query, res)
    }
    res.send('Invalid Request')
  }
}
