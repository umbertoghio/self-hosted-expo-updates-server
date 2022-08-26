const process = require('process')

const doShutdown = () => {
  process.exit()
}

// Handle OS Signals
process.on('SIGINT', doShutdown)
process.on('SIGTERM', doShutdown)
