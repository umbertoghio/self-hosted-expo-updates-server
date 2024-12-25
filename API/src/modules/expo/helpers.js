const crypto = require('crypto')
const fs = require('fs')
const mime = require('mime')
const path = require('path')

function createHash (file, hashingAlgorithm, encoding) {
  return crypto.createHash(hashingAlgorithm).update(file).digest(encoding)
}

function getBase64URLEncoding (base64EncodedString) {
  return base64EncodedString.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

module.exports.convertToDictionaryItemsRepresentation = (obj) => {
  return new Map(
    Object.entries(obj).map(([k, v]) => [k, [v, new Map()]])
  )
}

module.exports.signRSASHA256 = (data, privateKey) => {
  const sign = crypto.createSign('RSA-SHA256')
  sign.update(data, 'utf8')
  sign.end()
  return sign.sign(privateKey, 'base64')
}

module.exports.getPrivateKeyAsync = async () => {
  const privateKeyPath = process.env.PRIVATE_KEY_PATH
  if (!privateKeyPath) return null

  let pemBuffer = ''
  try {
    pemBuffer = fs.readFileSync(path.resolve(privateKeyPath))
    return pemBuffer.toString('utf8')
  } catch (e) {
    return false
  }
}

module.exports.getAssetMetadataSync = ({ update, filePath, ext, isLaunchAsset, platform }) => {
  const normalizedFilePath = path.normalize(filePath).replace(/\\/g, '/');
  const assetFilePath = path.join(update.path, normalizedFilePath);
  const asset = fs.readFileSync(path.resolve(assetFilePath), null)
  const assetHash = getBase64URLEncoding(createHash(asset, 'sha256', 'base64'))
  const key = createHash(asset, 'md5', 'hex')
  const keyExtensionSuffix = isLaunchAsset ? 'bundle' : ext
  const contentType = isLaunchAsset ? 'application/javascript' : mime.getType(ext)

  return {
    hash: assetHash,
    key,
    fileExtension: `.${keyExtensionSuffix}`,
    contentType,
    url: `${process.env.PUBLIC_URL}/api/assets?asset=${assetFilePath}&contentType=${encodeURI(contentType)}&platform=${platform}`
  }
}

module.exports.getMetadataSync = (update) => {
  try {
    const metadataPath = `${update.path}/metadata.json`
    const updateMetadataBuffer = fs.readFileSync(path.resolve(metadataPath), null)
    const metadataJson = JSON.parse(updateMetadataBuffer.toString('utf-8'))

    return {
      metadataJson,
      createdAt: new Date(update.releasedAt).toISOString(),
      id: createHash(updateMetadataBuffer, 'sha256', 'hex')
    }
  } catch (error) {
    throw new Error(`No update found with runtime version: ${update.version}. Error: ${error}`)
  }
}

const convertSHA256HashToUUID = (value) => {
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20, 32)}`
}

module.exports.convertSHA256HashToUUID = convertSHA256HashToUUID

module.exports.getUpdateId = (pathToUpdate) => {
  const metadataPath = `${pathToUpdate}/metadata.json`
  const updateMetadataBuffer = fs.readFileSync(path.resolve(metadataPath), null)
  const id = createHash(updateMetadataBuffer, 'sha256', 'hex')
  return convertSHA256HashToUUID(id)
}
