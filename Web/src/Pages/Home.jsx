import { Flex, Card, Spinner, Button, Text } from '../Components'
import { invalidateQuery, useCQuery } from '../Services'
import { useNavigate } from 'react-router-dom'
import { DataTable } from 'primereact/datatable'
import { Column } from 'primereact/column'
const AppDisplay = ({ app, goto }) => {
  return (
    <Card fadein title={app._id.toUpperCase()} collapsable style={{ marginTop: 20 }}>

      <DataTable
        style={{ marginTop: 20, width: '100%' }}
        value={app.stats} paginator rows={10} emptyMessage='No releases found'
      >
        <Column field='updateId' header='Update ID' body={({ id }) => id ? id.split('-')[0] + '...' : 'Error'} />
        <Column field='releaseChannel' header='Rel. Channel' filter sortable />
        <Column field='version' header='Version' filter sortable />
        <Column field='status' header='Status' filter sortable />
        <Column field='clients' header='Devices' sortable />

      </DataTable>
      <Flex fw style={{ marginTop: 20, marginBottom: 20 }}>
        <Button icon='wrench' label='configure app & release updates' onClick={goto} style={{ width: 460 }} />
      </Flex>
    </Card>
  )
}
export default function Home () {
  const { data: apps, isSuccess } = useCQuery('apps')
  const navigate = useNavigate()
  if (!isSuccess) return <Spinner />

  return (
    <Flex fw js style={{ marginTop: 20, marginBottom: 300 }}>
      <Card
        fadeIn style={{ padding: 20, width: 900 }} customHeader={(
          <Flex js row fw style={{ alignSelf: 'center' }}>
            <Text title bold value='MY APPS' size={20} />
            <Button icon='sync' label='Refresh' onClick={() => invalidateQuery('apps')} style={{ marginLeft: 40 }} />
          </Flex>
      )}
      >
        {apps.length
          ? apps.map(app => <AppDisplay app={app} key={app._id} goto={() => navigate(`/app/${app._id}`)} />)
          : <Button label='Add your first app' onClick={() => navigate('/new')} />}
      </Card>
    </Flex>
  )
}
