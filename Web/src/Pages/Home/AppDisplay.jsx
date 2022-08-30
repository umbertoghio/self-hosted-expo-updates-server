import { Flex, Card, Spinner, Button, Text } from '../../Components'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { useCQuery } from '../../Services'
import moment from 'moment'

const platform = {
  android: 'Android',
  ios: 'iOS'
}
const formatDate = (date) => moment(date).format('YYYY-MM-DD HH:mm:ss')

export const AppDisplay = ({ app, goto }) => {
  const { data: stats, isSuccess } = useCQuery(['stats', app._id])

  const VersionTable = ({ stat = { updates: [] } }) => (
    <DataTable
      style={{ marginTop: 10, marginBottom: 40, width: '100%' }}
      value={stat.updates} paginator rows={10} emptyMessage='No releases found'
      header={
        <Flex as>
          <Text value={`VERSION ${stat.version} ${platform[stat.platform] || 'unknown'} (${stat.releaseChannel}) `} title size={20} />
          <Text value={`Embedded Update: ${stat.embeddedUpdate}`} title size={12} />
        </Flex>
        }
    >
      <Column header='Update ID' filter sortable body={({ isBuild, updateId }) => isBuild ? 'Embedded Update' : updateId} />
      <Column field='updateRequests' header='Upd. Requests' />
      <Column field='onThisVersion' header='On This Version' />
      <Column field='lastSeen' header='Last Request' body={({ lastSeen }) => formatDate(lastSeen)} />

    </DataTable>
  )

  const header = (
    <Flex row>
      <Text value={app._id.toUpperCase()} title size={20} />
      <Button icon='wrench' round onClick={goto} style={{ marginLeft: 20 }} />
    </Flex>
  )
  return (
    <Card fadein collapsable style={{ marginTop: 20, width: '100%' }} customHeader={header}>

      {isSuccess
        ? stats.length
            ? stats.map((stat, ind) => <VersionTable key={app._id + ind} stat={stat} />)
            : <Text value='No clients have made requests for updates on this server yet.' style={{ marginBottom: 20 }} />
        : <Spinner />}

      <Flex fw style={{ marginBottom: 20 }}>
        <Button icon='wrench' label='configure app & release updates' onClick={goto} style={{ width: 380 }} />
      </Flex>
    </Card>
  )
}
