import { Flex, Card, Text, Input, Button, Spinner } from '../../Components'
import { FC, invalidateQuery } from '../../Services'
import { useState } from 'react'

const downloadPem = (certificate, filename) => {
  const element = document.createElement('a')
  const file = new Blob([certificate], {
    type: 'text/plain'
  })
  element.href = URL.createObjectURL(file)
  element.download = filename
  document.body.appendChild(element)
  element.click()
  document.body.removeChild(element)
}

export const ConfigServer = ({ state: [update, setUpdate] }) => {
  const [loading, setLoading] = useState(false)

  const updateField = (field) => (value) => setUpdate({ ...update, [field]: value })

  const handleSelfSignedGenerate = async () => {
    setLoading(true)
    try {
      const { privateKey, certificate } = await FC.client.service('utils').get('generateSelfSigned')
      setUpdate({ ...update, privateKey, certificate })
      window.toast.show({
        severity: 'info',
        summary: 'Keys generated succesfully'
      })
      setLoading(false)
    } catch (e) {
      window.toast.show({
        severity: 'error',
        summary: 'Error',
        detail: e.message
      })
    }
    setLoading(false)
  }

  const handleSave = async () => {
    setLoading(true)
    try {
      const { _id, ...fields } = update
      await FC.client.service('apps').patch(_id, { ...fields, lastUpdate: new Date() })
      invalidateQuery('app')
      window.toast.show({
        severity: 'info',
        summary: 'App info updated successfully'
      })
    } catch (e) {
      console.log(e)
      window.toast.show({
        severity: 'error',
        summary: 'Error',
        detail: e.message
      })
    }
    setLoading(false)
  }

  return (
    <Card title='SERVER CONFIGURATION' collapsable collapsed fadeIn style={{ padding: 20, width: 900, marginTop: 40 }}>
      <Flex as style={{ padding: 10 }}>
        <Text value={`Application Name: ${update._id}`} bold />
        {loading ? <Spinner /> : <Button label='Generate Self-Signed Keys' onClick={handleSelfSignedGenerate} style={{ marginTop: 20, marginBottom: 20 }} />}
        <Text value='Download / configure the certificate key inisde your app and ensure you have a backup of your private key!' />

        <Text value='App Certificate (download and add this certificate to your app.json):' style={{ marginTop: 20 }} />
        <Input multiline rows={18} useState={[update.certificate || '', updateField('certificate')]} style={{ marginTop: 10, width: 800 }} />
        <Button label='Download certificate' onClick={() => downloadPem(update.certificate, 'certificate.pem')} style={{ marginTop: 10 }} />

        <Text value='Private Key (used only on the server):' style={{ marginTop: 40 }} />
        <Input multiline rows={27} useState={[update.privateKey || '', updateField('privateKey')]} style={{ marginTop: 10, width: 800 }} />
        <Button label='Download Private Key' onClick={() => downloadPem(update.privateKey, 'privatekey.pem')} style={{ marginTop: 10 }} />

        {loading ? <Spinner /> : <Button label='Save' onClick={handleSave} style={{ marginTop: 40 }} />}

      </Flex>
    </Card>
  )
}
