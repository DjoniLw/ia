import { buildApp } from './app'
import { appConfig } from './config/app.config'
import { logger } from './shared/logger/logger'

async function main(): Promise<void> {
  const app = await buildApp()

  try {
    await app.listen({
      port: appConfig.port,
      host: '0.0.0.0',
    })

    logger.info(`🚀 Fluxa API running on port ${appConfig.port} [${appConfig.env}]`)
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }
}

main()
