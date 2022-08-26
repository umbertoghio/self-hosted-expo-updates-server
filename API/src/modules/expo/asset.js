const Err = require('@feathersjs/errors')
const path = require('path')
const fs = require('fs')

module.exports.handleAssetData = ({ query: { asset, contentType } }) => {
  if (!asset || !contentType) {
    throw new Err.BadRequest('No asset or contentType provided.')
  }

  if (asset.includes('app.json') || !asset.startsWith('/updates/')) {
    throw new Err.BadRequest('Invalid asset name.')
  }

  const assetPath = path.resolve(path.join(asset))
  if (!fs.existsSync(assetPath)) {
    throw new Err.BadRequest(`Asset "${asset}" does not exist.`)
  }

  return {
    type: 'asset',
    path: assetPath,
    contentType: decodeURI(contentType)
  }
}

module.exports.handleAssetResponse = (res) => {
  const asset = fs.readFileSync(res.data.path, null)
  res.type(res.data.contentType)
  res.end(asset)
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
