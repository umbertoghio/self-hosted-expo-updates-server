const pino = require('pino')

const prettyPino = {
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname',
      translateTime: true
    }
  }
}

const logger = process.env.NODE_ENV === 'production' ? pino() : pino(prettyPino)
const pinoLogger = {
  ...logger,
  info: (source, info) => info ? logger.info(source, info) : logger.info(source),
  error: (source, info) => info ? logger.error(source, info) : logger.error(source)

}

process.on('unhandledRejection', (reason, p) =>
  pinoLogger.error('API - Unhandled Rejection at: Promise ', { promise: p, reason }))

module.exports = pinoLogger
