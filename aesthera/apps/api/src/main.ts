import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildApp } from './app'
import { appConfig } from './config/app.config'
import { redis } from './database/redis/client'
import { logger } from './shared/logger/logger'

/**
 * Run `prisma db push` synchronously BEFORE the server binds its port.
 *
 * Running it synchronously (blocking) ensures the database schema is fully
 * up to date before any request is served.  A typical no-op push on an
 * already-synced schema completes in < 2 s; a push with real changes takes
 * < 15 s — both well within Railway's 120 s healthcheck timeout.
 *
 * If the push fails (bad DATABASE_URL, unreachable DB, …) the process exits
 * with a non-zero code so Railway marks the deploy as failed rather than
 * silently serving stale/broken endpoints.
 */
function syncSchemaSync(): void {
  const prismaBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'prisma')

  if (!existsSync(prismaBin)) {
    logger.warn(
      'Prisma binary not found — skipping schema sync. ' +
      'This is expected in development when running outside the Docker image.',
    )
    return
  }

  logger.info('⏳ Running prisma db push to sync schema…')
  try {
    execFileSync(prismaBin, ['db', 'push', '--accept-data-loss'], {
      timeout: 110_000,
      stdio: 'inherit',
    })
    logger.info('✅ Schema sync complete (prisma db push succeeded)')
  } catch (err) {
    logger.error(
      { err },
      '❌ prisma db push failed — aborting startup to prevent serving a broken schema. ' +
      'Check DATABASE_URL and the Railway PostgreSQL service.',
    )
    process.exit(1)
  }
}

async function main(): Promise<void> {
  // Sync schema first — before the port is bound — so every request sees a
  // consistent, up-to-date database schema from the very first connection.
  syncSchemaSync()

  const app = await buildApp()

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

  // Non-fatal Redis connectivity check — only after port is bound.
  try {
    await redis.ping()
    logger.info('Redis connection verified')
  } catch {
    logger.warn(
      'Redis is not reachable (REDIS_URL may not be set). ' +
      'Authentication endpoints will return 503 until Redis is available.',
    )
  }
}

main()
