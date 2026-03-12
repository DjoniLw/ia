import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { appConfig } from './config/app.config'
import { errorHandler } from './shared/errors/error-handler'
import { registerRequestId } from './shared/middleware/request-id'
import { authRoutes } from './modules/auth/auth.routes'
import { customersRoutes } from './modules/customers/customers.routes'
import { invoicesRoutes } from './modules/invoices/invoices.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { notificationsService } from './modules/notifications/notifications.service'

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
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
    },
    genReqId: () => crypto.randomUUID(),
  })

  // ── Plugins ────────────────────────────────────────────────────────────────

  await app.register(cors, {
    origin: appConfig.isProduction ? false : true,
    credentials: true,
  })

  await app.register(jwt, {
    secret: appConfig.jwt.secret,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // ── Hooks ──────────────────────────────────────────────────────────────────

  registerRequestId(app)

  // ── Error handler ──────────────────────────────────────────────────────────

  app.setErrorHandler(errorHandler)

  // ── Health check (PUBLIC - no auth required) ───────────────────────────────

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: appConfig.env,
  }))

  app.get('/status', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: appConfig.env,
  }))

  // ── Module routes ──────────────────────────────────────────────────────────

  await authRoutes(app)
  await customersRoutes(app)
  await invoicesRoutes(app)
  await paymentsRoutes(app)
  await notificationsRoutes(app)

  // Initialize notifications service (subscribes to events)
  void notificationsService

  return app
}
