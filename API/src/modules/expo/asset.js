const Err = require('@feathersjs/errors')
const path = require('path')
const fs = require('fs')

const getAssetInfo = ({ asset, contentType }) => {
  if (!asset || !contentType) return ({ error: 'No asset or contentType provided.' })
  if (asset.includes('app.json') || asset.includes('package.json') || !asset.startsWith('/updates/')) return ({ error: 'Invalid asset name.' })

  const file = { contentType: decodeURI(contentType) }
  file.path = path.resolve(asset)
  if (!fs.existsSync(file.path)) return ({ error: `Asset "${asset}" does not exist.` })

  // Trim /updates from file.path to get the relative path
  file.path = file.path.replace(/^\/updates/, '')

  return file
}

module.exports.handleAssetData = ({ asset, contentType }, res) => {
  const file = getAssetInfo({ asset, contentType })
  if (file.error) return res.end(JSON.stringify(file))

  res.type(file.contentType)
  res.sendFile(file.path, { root: '/updates' }, function (err) {
    if (err) console.log('Error sending file: ', file.path, file.contentType, err)
  })
}

module.exports.getJSONInfo = ({ path: paramPath }) => {
  if (!paramPath) throw new Err.BadRequest('Missing path parameter')

  const appJsonPath = path.resolve(`${paramPath}/app.json`)
  const pkgJsonPath = path.resolve(`${paramPath}/package.json`)
  if (!fs.existsSync(appJsonPath)) throw new Err.GeneralError('Error: app.json not found')
  if (!fs.existsSync(pkgJsonPath)) throw new Err.GeneralError('Error: package.json not found')

  const appJsonBuffer = fs.readFileSync(path.resolve(appJsonPath), null)
  const appJson = JSON.parse(appJsonBuffer.toString('utf-8'))

  const pkgJsonBuffer = fs.readFileSync(path.resolve(pkgJsonPath), null)
  const pkgJson = JSON.parse(pkgJsonBuffer.toString('utf-8'))
  return {
    appJson: appJson.expo,
    dependencies: pkgJson.dependencies
  }
}
