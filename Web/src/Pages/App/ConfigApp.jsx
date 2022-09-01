import { Card, Text, Input } from '../../Components'
import { FC } from '../../Services'

export const getAndroidMetadata = ({ _id, certificate = '' }) => {
  const output = `<meta-data android:name="expo.modules.updates.CODE_SIGNING_CERTIFICATE" android:value="${certificate.split('\r\n').join('&#xD;&#xA;')}"/>
  <meta-data android:name="expo.modules.updates.CODE_SIGNING_METADATA" android:value="{&quot;keyid&quot;:&quot;main&quot;,&quot;alg&quot;:&quot;rsa-v1_5-sha256&quot;}"/>
  <meta-data android:name="expo.modules.updates.ENABLED" android:value="true"/>
  <meta-data android:name="expo.modules.updates.EXPO_RUNTIME_VERSION" android:value="1.x.y"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_CHECK_ON_LAUNCH" android:value="NEVER"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATES_LAUNCH_WAIT_MS" android:value="0"/>
  <meta-data android:name="expo.modules.updates.EXPO_UPDATE_URL" android:value="${FC.server}/api/manifest?project=${_id}&amp;channel=myReleaseChannel"/>
  `
  return output
}

export const getIOSMetadata = ({ _id, certificate = '' }) => {
  const output = `<?xml version="1.0" encoding="UTF-8"?>
  <!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
  <plist version="1.0">
    <dict>
      <key>EXUpdatesCheckOnLaunch</key>
      <string>NEVER</string>
      <key>EXUpdatesCodeSigningCertificate</key>
      <string>${certificate.split('\r\n').join('&#xD;\r\n')}</string>
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
      <key>EXUpdatesRuntimeVersion</key>
      <string>1.x.y</string>
      <key>EXUpdatesURL</key>
      <string>${FC.server}/api/manifest?project=${_id}&amp;channel=myReleaseChannel</string>
    </dict>
  </plist>`
  return output
}

export const getUpdateAppjson = ({ _id, certificate = '' }) => {
  const output = `  "runtimeVersion": "1.x.y",
  "updates": {
    "url": "${FC.server}/api/manifest?project=${_id}&channel=myReleaseChannel",
    "enabled": true,
    "checkAutomatically": "ON_ERROR_RECOVERY",
    "fallbackToCacheTimeout": 0,
    "codeSigningCertificate": "./path/to/certificate.pem",
    "codeSigningMetadata": {
      "keyid": "main",
      "alg": "rsa-v1_5-sha256"
    }
  },`
  return output
}

export const ConfigApp = ({ app }) => {
  return (
    <Card title='APP CONFIGURATION' collapsable collapsed fadeIn style={{ padding: 20, width: '100%', maxWidth: 900, marginTop: 40 }}>

      <Text value='Expo Updates configuration in app.json, runtimeVersion is required.' style={{ marginTop: 40 }} />

      <Input multiline rows={9} useState={[getUpdateAppjson(app), () => null]} style={{ marginTop: 10, width: 800 }} />

      <Text value='For ejected apps run "expo prebuild" to setup automatically native iOS and Android settings after you set app.json, or use the generated code below.' style={{ marginTop: 10 }} />

      <Text value='Expo Updates config in android-manifest.xml' style={{ marginTop: 40 }} />
      <Input multiline rows={10} useState={[getAndroidMetadata(app), () => null]} style={{ marginTop: 10, width: 800 }} />

      <Text value='Expo Updates config in Expo.plist' style={{ marginTop: 40 }} />
      <Input multiline rows={10} useState={[getIOSMetadata(app), () => null]} style={{ marginTop: 10, width: 800 }} />
    </Card>
  )
}
