const Err = require('@feathersjs/errors')

module.exports.getRequestParams = ({ query, headers }) => {
  const project = headers['expo-project'] ?? query.project
  if (!project || typeof project !== 'string') {
    throw new Err.BadRequest('No expo-project header or project qyery provided.')
  }

  const platform = headers['expo-platform'] ?? query.platform
  if (platform !== 'ios' && platform !== 'android') {
    throw new Err.BadRequest('Missing expo-platform header or platform qyery provided. Expected either ios or android.')
  }

  const runtimeVersion = headers['expo-runtime-version'] ?? query['runtime-version']
  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    throw new Err.BadRequest('Missing expo-runtime-version header or runtime-version qyery provided.')
  }

  const releaseChannel = headers['expo-channel-name'] ?? query.channel
  if (!releaseChannel || typeof releaseChannel !== 'string') {
    throw new Err.BadRequest('Missing expo-channel-name header orchannel-name qyery provided.')
  }

  return {
    project,
    platform,
    runtimeVersion,
    releaseChannel
  }
}
