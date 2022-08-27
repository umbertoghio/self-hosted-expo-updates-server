import { Text, Card, Spinner } from '../../Components'
import { useCQuery } from '../../Services'
import { UpdateInfo } from './UpdateInfo'

export const PublishedUpdates = ({ app }) => {
  const { data: published, isSuccess } = useCQuery(['published', app._id])

  if (!isSuccess) return <Spinner />
  return (
    <Card title='PUBLISHED UPDATES' collapsable collapsed={!published.length} fadeIn style={{ padding: 20, width: '100%', maxWidth: 900, marginTop: 40 }}>
      {!published.length && <Text value='No published updates yet, upload and release one to see it here' />}
      {published.map((update, ind) => (
        <Card key={update._id} collapsable collapsed={!!ind} title={`${update.version} - ${update.releaseChannel} - ${update.gitCommit}`} style={{ marginTop: 20 }}>
          <UpdateInfo update={update} />
        </Card>
      ))}
    </Card>
  )
}
