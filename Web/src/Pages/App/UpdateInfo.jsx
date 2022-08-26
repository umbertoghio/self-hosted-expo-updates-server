import { useState } from 'react'
import { Flex, Input, Text, Button } from '../../Components'
import { Dialog } from 'primereact/dialog'

import moment from 'moment'

const getSize = (size) => {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KB`
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

const formatDate = (date) => moment(date).format('YYYY-MM-DD HH:mm:ss')

export const UpdateInfo = ({ update }) => {
  const [config, setConfig] = useState(false)
  return (
    <Flex fw as>
      <Text value={`Update ID: ${update.updateId || 'Not Released'}`} />
      <Text value={`Created: ${formatDate(update.createdAt)}`} />
      <Text value={`Release Channel: ${update.releaseChannel}`} />
      <Text value={`Version: ${update.version}`} />
      <Text value={`Git Branch: ${update.gitBranch}`} />
      <Text value={`Git Commit: ${update.gitCommit}`} />
      <Text value={`Original Filename: ${update.originalname}`} />
      <Text value={`Uploaded file: ${update.filename}`} />
      <Text value={`Size: ${getSize(parseInt(update.size || 0))}`} />
      <Text value={`Status: ${update.status}`} />
      <Text value={`Released On: ${update.releasedAt ? formatDate(update.releasedAt) : 'Not Released'}`} />
      <Text value={`Path: ${update.path || 'none'}`} />
      <Button icon='wrench' label='Dependencies & Config' onClick={() => setConfig(true)} style={{ marginTop: 10 }} />

      <Dialog visible={config} modal onHide={() => setConfig(false)} header={<Text value='Dependencies & app.json' bold size={28} />} style={{ width: 900 }}>
        <Text value='Dependencies in package.json:' style={{ marginBottom: 10 }} />
        <Input multiline value={JSON.stringify(update.dependencies, null, 4)} rows={10} />
        <Text value='Config in app.json:' style={{ marginTop: 20, marginBottom: 10 }} />
        <Input multiline value={JSON.stringify(update.appJson, null, 4)} rows={10} />
      </Dialog>
    </Flex>
  )
}
