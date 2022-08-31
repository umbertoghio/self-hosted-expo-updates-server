import { StatusBar } from 'expo-status-bar'
import { StyleSheet, Text, View, TouchableOpacity, Image } from 'react-native'
import * as Updates from 'expo-updates'
import React, { useEffect, useState } from 'react'

const wait = async (seconds) => new Promise(resolve => setTimeout(resolve, seconds * 1000))

export default function App () {
  const [update, setUpdate] = useState('')

  const doUpdate = async () => {
    try {
      setUpdate('Checking for updates...')
      await wait(2)
      const upd = await Updates.checkForUpdateAsync()
      setUpdate('update Available? ' + upd.isAvailable + ' - ' + JSON.stringify(upd))
      await wait(2)

      if (upd.isAvailable) {
        setUpdate('About to Fetch... ')
        await wait(2)

        try {
          const fetched = await Updates.fetchUpdateAsync()
          setUpdate('Update fetched? ' + fetched.isNew + ' - ' + JSON.stringify(fetched))
        } catch (e) {
          setUpdate('Error fetching update: ' + e)
        }
      } else {
        setUpdate('App Ready on ' + Updates.channel)
      }
    } catch (e) {
      setUpdate('Error else: ' + e)
    }
  }

  useEffect(() => {
    setUpdate('Started')
  }, [])
  return (
    <View style={styles.container}>
      <StatusBar style='auto' />

      <Text>This is a simple app to test the update mechanism</Text>

      <TouchableOpacity style={{ backgroundColor: '#2D447A', padding: 20, margin: 20, borderRadius: 20 }} onPress={doUpdate}>
        <Text style={{ color: 'white', fontSize: 18 }}>Check for an update</Text>
      </TouchableOpacity>

      <TouchableOpacity style={{ backgroundColor: '#2D447A', padding: 20, margin: 20, borderRadius: 20 }} onPress={() => Updates.reloadAsync()}>
        <Text style={{ color: 'white', fontSize: 18 }}>Reload App </Text>
      </TouchableOpacity>

      <Text>This is the update number 8</Text>

      <Text>{update}</Text>
      <Image source={require('./assets/img.png')} style={{ width: 100, height: 100 }} />

    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center'
  }
})
