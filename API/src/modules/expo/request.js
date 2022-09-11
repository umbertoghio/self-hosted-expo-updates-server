module.exports.getRequestParams = ({ query, headers }) => {
  const project = query.project ?? headers['expo-project']
  if (!project || typeof project !== 'string') return ({ error: 'No expo-project header or project qyery provided.' })

  const platform = query.platform ?? headers['expo-platform']
  if (platform !== 'ios' && platform !== 'android') return ({ error: 'Missing expo-platform header or platform qyery provided. Expected either ios or android.' })

  const runtimeVersion = query.version ?? headers['expo-runtime-version']
  if (!runtimeVersion || typeof runtimeVersion !== 'string') return ({ error: 'Missing expo-runtime-version header or runtime-version qyery provided.' })

  const releaseChannel = query.channel ?? headers['expo-channel-name']
  if (!releaseChannel || typeof releaseChannel !== 'string') return ({ error: 'Missing expo-channel-name header orchannel-name qyery provided.' })

  return {
    project,
    platform,
    runtimeVersion,
    releaseChannel
  }
}
