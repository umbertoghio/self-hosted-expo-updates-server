const Err = require('@feathersjs/errors')

module.exports.getRequestParams = ({ query, headers }) => {
  const project = query.project ?? headers['expo-project']
  if (!project || typeof project !== 'string') {
    throw new Err.BadRequest('No expo-project header or project query provided.')
  }

  const platform = query.platform ?? headers['expo-platform']
  if (platform !== 'ios' && platform !== 'android') {
    throw new Err.BadRequest('Missing expo-platform header or platform query provided. Expected either ios or android.')
  }

  const runtimeVersion = query.version ?? headers['expo-runtime-version']
  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    throw new Err.BadRequest('Missing expo-runtime-version header or runtime-version query provided.')
  }

  const releaseChannel = query.channel ?? headers['expo-channel-name']
  if (!releaseChannel || typeof releaseChannel !== 'string') {
    throw new Err.BadRequest('Missing expo-channel-name header orchannel-name query provided.')
  }

  return {
    project,
    platform,
    runtimeVersion,
    releaseChannel
  }
}
