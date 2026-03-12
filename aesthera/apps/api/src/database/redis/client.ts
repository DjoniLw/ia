import Redis from 'ioredis'
import { appConfig } from '../../config/app.config'
import { logger } from '../../shared/logger/logger'

export const redis = new Redis(appConfig.redis.url, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
})

redis.on('connect', () => {
  logger.info('Redis connected')
})

redis.on('error', (err) => {
  logger.error({ err }, 'Redis error')
})
