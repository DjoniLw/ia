import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildApp } from './app'
import { appConfig } from './config/app.config'
import { redis } from './database/redis/client'
import { logger } from './shared/logger/logger'

/**
 * Run `prisma db push` in the background AFTER the server has already
 * bound to its port.  This ensures:
 *   1. The HTTP server is always reachable (Railway health check passes).
 *   2. Schema changes are applied automatically on every deploy.
 *   3. A slow / unreachable database never blocks port binding.
 *
 * The prisma binary lives at `<project-root>/node_modules/.bin/prisma`.
 * In the Docker image the compiled output is in `dist/` one level below
 * the project root, so `__dirname/..` resolves to the project root.
 */

// Must be shorter than Railway's healthcheckTimeout (120 s) so the
// background process does not outlive a failed deployment attempt.
const SCHEMA_SYNC_TIMEOUT_MS = 110_000
function syncSchemaNonBlocking(): void {
  const prismaBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'prisma')

  if (!existsSync(prismaBin)) {
    logger.warn(
      'Prisma binary not found — skipping schema sync. ' +
      'This is expected in development when running outside the Docker image.',
    )
    return
  }

  execFile(
    prismaBin,
    ['db', 'push', '--accept-data-loss'],
    { timeout: SCHEMA_SYNC_TIMEOUT_MS },
    (error) => {
      if (error) {
        logger.warn(
          { err: error },
          '⚠️  Schema sync (prisma db push) failed — API is running but DB schema may be out of date. ' +
          'Check DATABASE_URL and the Railway PostgreSQL service.',
        )
      } else {
        logger.info('✅ Schema sync complete (prisma db push succeeded)')
      }
    },
  )
}

async function main(): Promise<void> {
  const app = await buildApp()

  // Bind to the port FIRST so Railway's health check always succeeds.
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

  // Kick off schema sync in the background — never blocks the server.
  syncSchemaNonBlocking()
}

main()
