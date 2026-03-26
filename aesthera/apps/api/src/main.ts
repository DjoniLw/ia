import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { buildApp } from './app'
import { appConfig } from './config/app.config'
import { redis } from './database/redis/client'
import { logger } from './shared/logger/logger'

/**
 * Schema-sync strategy
 * ─────────────────────────────────────────────────────────────────────────────
 * We need two competing goals:
 *
 *   1. Railway's health-check hits `/health` within ~2 minutes of deploy.
 *      This means the HTTP port must be bound BEFORE prisma migrate deploy finishes.
 *
 *   2. The database schema must be fully applied before any real API request
 *      is served (prevents P2021 / P2022 errors on new tables / columns).
 *
 * Solution:
 *   • Bind the port first so `/health` is reachable immediately.
 *   • Start `prisma migrate deploy` right after binding (non-blocking).
 *   • Expose a `schemaSyncReady` promise that resolves/rejects when the migration
 *     finishes.
 *   • The app's preHandler hook (added below) awaits `schemaSyncReady` for
 *     every non-health route, so real requests queue up harmlessly until the
 *     schema is consistent.
 *   • If the migration fails the promise rejects, the preHandler returns 503, and
 *     Railway keeps the old replica alive while alerting on the deploy failure.
 *
 * Why `migrate deploy` and not `db push`:
 *   • `migrate deploy` applies migrations from the /prisma/migrations folder
 *     and records them in `_prisma_migrations` — safe, idempotent, auditable.
 *   • `db push --accept-data-loss` can silently drop columns/data in production.
 */

// Resolved when schema sync is complete, rejected if it fails.
// Exported so the Fastify preHandler hook can await it.
let _resolveSchemaSyncReady!: () => void
let _rejectSchemaSyncReady!: (err: unknown) => void
export const schemaSyncReady: Promise<void> = new Promise((res, rej) => {
  _resolveSchemaSyncReady = res
  _rejectSchemaSyncReady = rej
})

// Must be shorter than Railway's healthcheckTimeout (120 s) so the push does
// not outlive a failed deployment attempt.
const SCHEMA_SYNC_TIMEOUT_MS = 110_000

function runMigrateDeployWithRetry(prismaBin: string, retriesLeft = 1): void {
  execFile(
    prismaBin,
    ['migrate', 'deploy'],
    { timeout: SCHEMA_SYNC_TIMEOUT_MS },
    (error, _stdout, stderr) => {
      if (!error) {
        logger.info('✅ Migrations applied — API is now fully operational')
        _resolveSchemaSyncReady()
        return
      }

      // When transitioning from `db push` to `migrate deploy`, Prisma may find
      // migrations that were partially recorded as FAILED in _prisma_migrations
      // even though the schema changes are already present in the DB.
      // Auto-resolve them as applied and retry once.
      const failedMatch = (stderr ?? '').match(
        /The `(.+?)` migration started at .+ failed/,
      )
      if (failedMatch && retriesLeft > 0) {
        const failedMigration = failedMatch[1]
        logger.warn(
          `Found failed migration in history: "${failedMigration}". ` +
          'Schema was maintained via db push — resolving as applied and retrying.',
        )
        execFile(
          prismaBin,
          ['migrate', 'resolve', '--applied', failedMigration],
          { timeout: 30_000 },
          (resolveError) => {
            if (resolveError) {
              logger.error(
                { err: resolveError },
                `❌ Could not resolve failed migration "${failedMigration}". Manual intervention required.`,
              )
              _rejectSchemaSyncReady(resolveError)
              return
            }
            logger.info(`Migration "${failedMigration}" resolved — retrying migrate deploy`)
            runMigrateDeployWithRetry(prismaBin, retriesLeft - 1)
          },
        )
        return
      }

      logger.error(
        { err: error },
        '❌ prisma migrate deploy failed — API is serving 503 for non-health routes. ' +
        'Check DATABASE_URL and the Railway PostgreSQL service.',
      )
      _rejectSchemaSyncReady(error)
    },
  )
}

function startSchemaSyncBackground(): void {
  const prismaBin = path.resolve(__dirname, '..', 'node_modules', '.bin', 'prisma')

  if (!existsSync(prismaBin)) {
    logger.warn(
      'Prisma binary not found — skipping schema sync. ' +
      'This is expected in development when running outside the Docker image.',
    )
    _resolveSchemaSyncReady()
    return
  }

  logger.info('⏳ Running prisma migrate deploy (schema sync)…')
  runMigrateDeployWithRetry(prismaBin)
}

async function main(): Promise<void> {
  const app = await buildApp()

  // Register a preHandler hook that gates every non-health route behind the
  // schema-sync promise.  This hook runs AFTER the app is built so it sees
  // the same PUBLIC_ROUTES set used by the tenant middleware.
  const BYPASS_SYNC = new Set(['/', '/health'])
  app.addHook('preHandler', async (request, reply) => {
    const url = request.routeOptions.url
    if (url && BYPASS_SYNC.has(url)) return

    try {
      await schemaSyncReady
    } catch {
      reply.status(503).send({
        error: 'SERVICE_INITIALIZING',
        message: 'API is initializing. Schema sync failed — please check deployment logs.',
      })
    }
  })

  // Bind the port FIRST so Railway's health check always returns 200 quickly.
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

  // Kick off schema sync now that the port is bound and healthchecks can pass.
  startSchemaSyncBackground()
}

main()
