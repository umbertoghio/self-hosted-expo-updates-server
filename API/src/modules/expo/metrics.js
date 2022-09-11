const { getRequestParams } = require('./request')

const throttleController = {}

const sendReactQueryUpdate = ({ app, project }) => {
  throttleController[project].lastCall = Date.now()
  app.service('messages').create({ action: 'update', keys: [['stats', project]] })
}

const handleWebClientRefresh = async ({ app, project, throttleTime }) => {
  if (!throttleController[project]) { // Never called an update before, calling now
    throttleController[project] = {}
    sendReactQueryUpdate({ app, project })
    return true
  }

  const timeSinceLastCall = Date.now() - throttleController[project].lastCall

  if (timeSinceLastCall > throttleTime) { // Enough time passed, calling now
    sendReactQueryUpdate({ app, project })
  } else {
  // Not Enough time passed, debouncing
    clearTimeout(throttleController[project].debounce)
    throttleController[project].debounce = setTimeout(() => {
      sendReactQueryUpdate({ app, project })
    }, throttleTime - timeSinceLastCall)
  }
}

module.exports.clientMetrics = async ({ app, throttleTime, query, headers }) => {
  const _id = headers['eas-client-id']
  const embeddedUpdate = headers['expo-embedded-update-id']
  const currentUpdate = headers['expo-current-update-id']

  const { error, project, platform, runtimeVersion, releaseChannel } = getRequestParams({ query, headers })
  if (error || !_id || !embeddedUpdate || !currentUpdate) return false

  const [client] = await app.service('clients').find({ query: { _id } })
  if (client) {
    await app.service('clients').patch(client._id, {
      lastSeen: new Date().toISOString(),
      version: runtimeVersion,
      embeddedUpdate,
      currentUpdate,
      updateCount: 1 + (client.updateCount || 0)
    })
  } else {
    await app.service('clients').create({
      _id: headers['eas-client-id'],
      lastSeen: new Date().toISOString(),
      firstSeen: new Date().toISOString(),
      project,
      version: runtimeVersion,
      platform,
      releaseChannel,
      embeddedUpdate,
      currentUpdate,
      updateCount: 1
    })
  }

  handleWebClientRefresh({ app, project, throttleTime })
}
