import { Flex, Spinner } from '../../Components'
import { useParams } from 'react-router-dom'
import { useCQuery } from '../../Services'
import { useState, useEffect } from 'react'
import { ConfigServer } from './ConfigServer'
import { ConfigApp } from './ConfigApp'
import { ReleaseManager } from './ReleaseManager'
import { PublishedUpdates } from './PublishedUpdates'

export default function App () {
  const { appId = '' } = useParams()
  const { data: app, isSuccess } = useCQuery(['app', appId])
  const [appUpdate, setAppUpdate] = useState(app || {})

  useEffect(() => {
    setAppUpdate(app || {})
  }, [appId, app])

  if (!isSuccess) return <Spinner />
  return (
    <Flex fw js style={{ padding: 20, marginBottom: 300 }}>
      <ReleaseManager app={appUpdate} />
      <PublishedUpdates app={appUpdate} />
      <ConfigServer state={[appUpdate, setAppUpdate]} />
      <ConfigApp app={appUpdate} />
    </Flex>
  )
}
