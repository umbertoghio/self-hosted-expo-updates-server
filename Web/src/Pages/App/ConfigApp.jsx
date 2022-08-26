import { Card, Text, Input } from '../../Components'
import { FC } from '../../Services'

export const getAndroidMetadata = ({ _id, certificate = '' }) => {
  const output = `<meta-data android:name="expo.modules.updates.CODE_SIGNING_CERTIFICATE" android:value="${certificate.split('\r\n').join('&#xA;')}"/>
  <meta-data android:name="expo.modules.updates.CODE_SIGNING_METADATA" android:value="{&quot;keyid&quot;:&quot;main&quot;,&quot;alg&quot;:&quot;rsa-v1_5-sha256&quot;}"/>
  <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
  <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="1.1.1"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="ERROR_RECOVERY_ONLY"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="${FC.server}/api/manifest"/>
  <meta-data android:name="expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY" android:value="{'expo-channel-name':'myReleaseChannel', 'expo-project': '${_id}'}"/>
  `
  return output
}

export const getIOSMetadata = ({ _id, certificate = '' }) => {
  const output = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>EXUpdatesCheckOnLaunch</key>
      <string>ERROR_RECOVERY_ONLY</string>
      <key>EXUpdatesCodeSigningCertificate</key>
      <string>${certificate.split('\r\n').join('&#xD;\r\n')}</string>
  </string>
      <key>EXUpdatesCodeSigningMetadata</key>
      <dict>
        <key>keyid</key>
        <string>main</string>
        <key>alg</key>
        <string>rsa-v1_5-sha256</string>
      </dict>
      <key>EXUpdatesEnabled</key>
      <true/>
      <key>EXUpdatesLaunchWaitMs</key>
      <integer>0</integer>
      <key>EXUpdatesRequestHeaders</key>
      <dict>
        <key>expo-channel-name</key>
        <string>myReleaseChannel</string>
        <key>expo-project</key>
        <string>${_id}</string>
      </dict>
      <key>EXUpdatesRuntimeVersion</key>
      <string>1.1.1</string>
      <key>EXUpdatesURL</key>
      <string>${FC.server}/api/manifest</string>
    </dict>
  </plist>`
  return output
}

export const getUpdateAppjson = ({ _id, certificate = '' }) => {
  const output = `"updates": {
    "url": "${FC.server}/api/manifest",
    "enabled": true,
    "checkAutomatically": "ON_ERROR_RECOVERY",
    "fallbackToCacheTimeout": 0,
    "codeSigningCertificate": "./path/to/certificate.pem",
    "codeSigningMetadata": {
      "keyid": "main",
      "alg": "rsa-v1_5-sha256"
    },
    "requestHeaders": {
      "expo-channel-name":"myReleaseChannel",
      "expo-project": "${_id}"
    }
  },`
  return output
}

export const ConfigApp = ({ app }) => {
  return (
    <Card title='APP CONFIGURATION' collapsable collapsed fadeIn style={{ padding: 20, width: 900, marginTop: 40 }}>

      <Text value='Use expo prebuild to setup automatically (currently a patch is required for expo-config, PR open to support requestHeaders)' style={{ marginTop: 10 }} />
      <Text value='Or use the following configuration in your native apps' style={{ marginTop: 10 }} />

      <Text value='Expo Updates config in app.json' style={{ marginTop: 40 }} />

      <Input multiline rows={14} useState={[getUpdateAppjson(app), () => null]} style={{ marginTop: 10, width: 800 }} />

      <Text value='Expo Updates config in android-manifest.xml' style={{ marginTop: 40 }} />
      <Input multiline rows={18} useState={[getAndroidMetadata(app), () => null]} style={{ marginTop: 10, width: 800 }} />

      <Text value='Expo Updates config in Expo.plist' style={{ marginTop: 40 }} />
      <Input multiline rows={18} useState={[getIOSMetadata(app), () => null]} style={{ marginTop: 10, width: 800 }} />
    </Card>
  )
}
