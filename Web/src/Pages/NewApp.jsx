import { useState } from 'react'
import { Flex, Card, Input, Button, Spinner } from '../Components'
import { FC, invalidateQuery } from '../Services'
import { useNavigate } from 'react-router-dom'

export default function NewApp () {
  const [slug, setSlug] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  const handleCreate = async () => {
    setLoading(true)
    try {
      if (!slug) throw new Error('Please enter the application slug')
      const { _id } = await FC.client.service('apps').create({ _id: slug })
      window.toast.show({
        severity: 'info',
        summary: 'App Created',
        detail: 'Redirecting to app page...'
      })
      invalidateQuery('apps')
      setTimeout(() => navigate(`/app/${_id}`), 2000)
    } catch (e) {
      window.toast.show({
        severity: 'error',
        summary: 'Error',
        detail: e.message
      })
      setLoading(false)
    }
  }
  return (
    <Flex fw fh>
      <Card fadeIn title='NEW EXPO APP' style={{ padding: 20, maxWidth: 400 }}>
        <Flex style={{ padding: 10 }}>
          <Input autofocus placeholder='expo slug name' useState={[slug, setSlug]} />
          {loading
            ? <Spinner />
            : <Button icon='plus' label='Create new App' onClick={handleCreate} style={{ marginTop: 20 }}>Create</Button>}
        </Flex>
      </Card>
    </Flex>
  )
}
