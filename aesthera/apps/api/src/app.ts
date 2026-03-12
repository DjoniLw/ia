import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { appConfig } from './config/app.config'
import { errorHandler } from './shared/errors/error-handler'
import { registerRequestId } from './shared/middleware/request-id'
import { authRoutes } from './modules/auth/auth.routes'
import { clinicsRoutes } from './modules/clinics/clinics.routes'
import { customersRoutes } from './modules/customers/customers.routes'
import { professionalsRoutes } from './modules/professionals/professionals.routes'
import { servicesRoutes } from './modules/services/services.routes'
import { usersRoutes } from './modules/users/users.routes'
import { appointmentsRoutes } from './modules/appointments/appointments.routes'
import { billingRoutes } from './modules/billing/billing.routes'
import { paymentsRoutes } from './modules/payments/payments.routes'
import { ledgerRoutes } from './modules/ledger/ledger.routes'
import { notificationsRoutes } from './modules/notifications/notifications.routes'
import { aiRoutes } from './modules/ai/ai.routes'
import './domain-event-handlers'

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

  // ── Plugins ──────────────────────────────────────────────────────────────────
  await app.register(cors, {
    origin: appConfig.isProduction ? false : true,
    credentials: true,
  })

  await app.register(jwt, {
    secret: appConfig.jwt.secret,
  })

  await app.register(rateLimit, {
    max: 200,
    timeWindow: '1 minute',
  })

  // ── Hooks ─────────────────────────────────────────────────────────────────────
  registerRequestId(app)

  // ── Error handler ─────────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler)

  // ── Health check (PUBLIC — no tenant, no auth) ────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aesthera-api',
    env: appConfig.env,
  }))

  // ── Module routes ─────────────────────────────────────────────────────────────
  await authRoutes(app)
  await clinicsRoutes(app)
  await usersRoutes(app)
  await servicesRoutes(app)
  await professionalsRoutes(app)
  await customersRoutes(app)
  await appointmentsRoutes(app)
  await billingRoutes(app)
  await paymentsRoutes(app)
  await ledgerRoutes(app)
  await notificationsRoutes(app)
  await aiRoutes(app)

  return app
}
