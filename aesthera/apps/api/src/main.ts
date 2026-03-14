import { buildApp } from './app'
import { appConfig } from './config/app.config'
import { redis } from './database/redis/client'
import { logger } from './shared/logger/logger'

async function main(): Promise<void> {
  const app = await buildApp()

  // Non-fatal startup connectivity check — warns operators when Redis is not
  // configured so they know auth operations will return 503 until it is.
  try {
    await redis.ping()
    logger.info('Redis connection verified')
  } catch {
    logger.warn(
      'Redis is not reachable (REDIS_URL may not be set). ' +
      'Authentication endpoints will return 503 until Redis is available.',
    )
  }

  try {
    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    })

    logger.info(`🚀 Aesthera API running on port ${appConfig.port} [${appConfig.env}]`)
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

main()
