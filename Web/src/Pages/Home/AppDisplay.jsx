import { Flex, Card, Spinner, Button, Text } from '../../Components'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
import { useCQuery } from '../../Services'

export const AppDisplay = ({ app, goto }) => {
  const { data: stats, isSuccess } = useCQuery(['stats', app._id])

  const VersionTable = ({ version, info: { embeddedUpdate, updates } = {} }) => (
    <DataTable
      style={{ marginTop: 10, marginBottom: 40, width: '100%' }}
      value={updates} paginator rows={10} emptyMessage='No releases found'
      header={
        <Flex as>
          <Text value={`VERSION ${version}`} title size={20} />
          <Text value={`Embedded Update: ${embeddedUpdate}`} title size={12} />
        </Flex>
        }
    >
      <Column field='updateId' header='Update ID' filter sortable />
      <Column field='releaseChannel' header='Rel. Channel' filter sortable />
      <Column field='updateRequests' header='Upd. Requests' />
      <Column field='onThisVersion' header='On This Version' />
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
            ? stats.map(({ version, ...info }) => <VersionTable key={app._id + version} version={version} info={info} />)
            : <Text value='No clients have made requests for updates on this server yet.' style={{ marginBottom: 20 }} />
        : <Spinner />}

      <Flex fw style={{ marginBottom: 20 }}>
        <Button icon='wrench' label='configure app & release updates' onClick={goto} style={{ width: 380 }} />
      </Flex>
    </Card>
  )
}
