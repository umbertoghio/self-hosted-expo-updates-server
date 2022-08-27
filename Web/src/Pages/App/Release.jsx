import { useState } from 'react'
import { Dialog } from 'primereact/dialog'

import { FC, invalidateQuery } from '../../Services'
import { UpdateInfo } from './UpdateInfo'
import { Flex, Button, Text, Spinner } from '../../Components'

export const Release = ({ update, onHide }) => {
  const [releasing, setRelasing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isReleased = update?.status === 'released'
  const isObsolete = update?.status === 'obsolete'

  const handleAction = (action) => async () => {
    setDeleting(false)
    setConfirming(false)
    setRelasing(true)
    try {
      const outcome = await FC.client.service('utils').update(action, { uploadId: update._id })
      if (!outcome || outcome?.error) throw new Error(outcome?.error || 'Unknown error')

      window.toast.show({
        severity: 'info',
        summary: 'Success',
        detail: `Update succesfully ${action === 'release' ? 'published' : 'deleted'}.`
      })
    } catch (e) {
      window.toast.show({
        severity: 'error',
        summary: 'Error',
        detail: e.message
      })
    }
    invalidateQuery(['uploads', 'published'])
    onHide()
    setRelasing(false)
  }

  const actionLabel = isReleased
    ? 'App is currently released'
    : (isObsolete ? 'Rollback' : 'Release')

  const Action = () => (
    <Flex row fw jb>
      <Button disabled={isReleased} icon='upload' label={actionLabel} style={{ marginTop: 20, marginBottom: 10 }} onClick={() => setConfirming(true)} />
      <Button disabled={isReleased} icon='trash' label='DELETE' style={{ marginTop: 20, marginBottom: 10 }} onClick={() => setDeleting(true)} />
    </Flex>
  )

  if (!update) return null
  return (
    <>
      <Dialog visible={!!update?._id} modal onHide={releasing ? () => null : onHide} style={{ width: '100%', maxWidth: 800, margin: 20 }} header={<Text value='Upload Details' bold size={28} />}>
        <Flex fw as>
          <UpdateInfo update={update} />
          {releasing ? <Spinner /> : <Action />}

        </Flex>
      </Dialog>

      <Dialog visible={confirming} modal style={{ width: '100%', maxWidth: 600 }} onHide={() => setConfirming(false)} header={<Text value='Release Upload to Apps' bold size={28} />}>
        <Text value={`You are about to release ${update.updateId} to all users in this Release Channel / Version.`} />
        {update.status === 'obsolete' && <Text value='This upload was released in the past before the current one, if you continue users will update to this older version.' style={{ marginTop: 20 }} />}
        <Text value='Are you sure?' style={{ marginTop: 20 }} />

        <Flex jb row fw style={{ marginTop: 20 }}>
          <Button icon='ban' label='Cancel' onClick={() => setConfirming(false)} />
          <Button icon='check' label={actionLabel} onClick={handleAction('release')} />
        </Flex>
      </Dialog>

      <Dialog visible={deleting} modal style={{ width: '100%', maxWidth: 600 }} onHide={() => setDeleting(false)} header={<Text value='Delete Upload' bold size={28} />}>
        <Text value={`You are about to delete ${update.updateId}, all related files will be permanently removed from the server.`} />
        <Text value='Are you sure?' style={{ marginTop: 20 }} />

        <Flex jb row style={{ width: 300, marginTop: 20 }}>

          <Button icon='ban' label='Cancel' onClick={() => setDeleting(false)} />
          <Button icon='check' label='DELETE' onClick={handleAction('delete')} />
        </Flex>
      </Dialog>
    </>
  )
}
