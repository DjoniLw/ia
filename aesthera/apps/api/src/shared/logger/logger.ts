import pino from 'pino'
import { appConfig } from '../../config/app.config'

export const logger = pino({
  level: appConfig.isProduction ? 'info' : 'debug',
  transport: appConfig.isProduction
    ? undefined
    : {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      },
})
