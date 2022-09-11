const FormData = require('form-data')
const { serializeDictionary } = require('structured-headers')
const Err = require('@feathersjs/errors')
const { getRequestParams } = require('./request')
const { getMetadataSync, convertSHA256HashToUUID, getAssetMetadataSync, signRSASHA256, convertToDictionaryItemsRepresentation } = require('./helpers')

const getSignature = async ({ headers, manifest, privateKey }) => {
  const expectSignatureHeader = !!headers['expo-expect-signature']
  if (!expectSignatureHeader) return ({})

  if (!privateKey) {
    throw new Err.BadRequest('Code signing requested but no key supplied when starting server.')
  }
  const manifestString = JSON.stringify(manifest)
  const hashSignature = signRSASHA256(manifestString, privateKey)
  const dictionary = convertToDictionaryItemsRepresentation({
    sig: hashSignature,
    keyid: 'main'
  })
  return ({ 'expo-signature': serializeDictionary(dictionary) })
}

const terminateResponse = (res, message) => {
  res.write(JSON.stringify({ message }))
  res.end()
}

module.exports.hanldeManifestData = async (app, { query, headers }, res) => {
  const { error, project, platform, runtimeVersion, releaseChannel } = getRequestParams({ query, headers })
  if (error) return terminateResponse(res, error)

  const [update] = await app.service('uploads').find({ query: { project, version: runtimeVersion, releaseChannel, status: 'released' } })
  if (!update) return terminateResponse(res, 'No uploads found')

  const application = await app.service('apps').get(update.project)
  if (!application) return terminateResponse(res, 'No application found')

  try {
    const { metadataJson, createdAt, id } = getMetadataSync(update)

    const platformSpecificMetadata = metadataJson.fileMetadata[platform]
    const manifest = {
      id: convertSHA256HashToUUID(id),
      createdAt,
      runtimeVersion,
      assets: platformSpecificMetadata.assets.map((asset) =>
        getAssetMetadataSync({
          update,
          filePath: asset.path,
          ext: asset.ext,
          runtimeVersion,
          platform,
          isLaunchAsset: false
        })
      ),
      launchAsset: getAssetMetadataSync({
        update,
        filePath: platformSpecificMetadata.bundle,
        isLaunchAsset: true,
        runtimeVersion,
        platform,
        ext: null
      })
    }

    const assetRequestHeaders = {};
    [...manifest.assets, manifest.launchAsset].forEach((asset) => {
      assetRequestHeaders[asset.key] = {
        'test-header': 'test-header-value'
      }
    })

    const form = new FormData()

    form.append('manifest', JSON.stringify(manifest), {
      contentType: 'application/json',
      header: {
        'content-type': 'application/json; charset=utf-8',
        ...(await getSignature({ headers, manifest, privateKey: application.privateKey }))
      }
    })

    form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
      contentType: 'application/json'
    })

    res.set('expo-protocol-version', 0)
    res.set('expo-sfv-version', 0)
    res.set('cache-control', 'private, max-age=0')
    res.set('content-type', `multipart/mixed; boundary=${form.getBoundary()}`)
    res.write(form.getBuffer())
    res.end()
  } catch (error) {
    terminateResponse(res, error.message)
    throw new Err.BadRequest(JSON.stringify(error))
  }
}
