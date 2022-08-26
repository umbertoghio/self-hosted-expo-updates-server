const http = require('http')

const options = {
  host: 'localhost',
  port: 3000,
  timeout: 2000,
  method: 'GET',
  path: '/status/'
}

let data = ''

const exit = (success, message) => {
  message && console[success ? 'log' : 'error'](message)
  process.exit(success ? 0 : 1)
}

const parseData = () => {
  try {
    const { ok } = JSON.parse(data)
    exit(ok, 'Health Check Completed, status: ' + ok)
  } catch (e) {
    exit(false, `Bad health check, result ${data}`)
  }
}

const getData = (response) => {
  if (response.statusCode !== 200) exit(false, `Bad health check, result ${response.statusCode}`)
  response.on('data', chunk => { data += chunk })
  response.on('end', parseData)
}

const request = http.request(options, getData)
request.on('error', (err) => exit(false, `An error occurred while performing health check, error: ${err}`))
request.end()
