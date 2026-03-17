import Fastify from 'fastify'
import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import { appConfig } from './config/app.config'
import { errorHandler } from './shared/errors/error-handler'
import { registerRequestId } from './shared/middleware/request-id'
import { tenantMiddleware } from './shared/middleware/tenant.middleware'
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
import { productsRoutes } from './modules/products/products.routes'
import { clinicalRoutes } from './modules/clinical/clinical.routes'
import { equipmentRoutes } from './modules/equipment/equipment.routes'
import { suppliesRoutes } from './modules/supplies/supplies.routes'
import { walletRoutes } from './modules/wallet/wallet.routes'
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
    origin: appConfig.cors.origin,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Slug', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id', 'X-Session-Id'],
    maxAge: 86400,
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

  // Apply tenant middleware globally, skipping routes that truly don't need a clinic context
  const PUBLIC_ROUTES = new Set([
    '/',
    '/health',
    '/auth/register',
    '/auth/verify-email',
    '/auth/refresh',
    '/auth/logout',
  ])

  app.addHook('preHandler', async (request, reply) => {
    // routeOptions.url is an empty string when no route was matched (Fastify
    // still runs preHandler hooks for its built-in not-found handler).
    // Bail out in that case so Fastify returns a normal 404 instead of
    // MISSING_TENANT.
    const url = request.routeOptions.url
    if (!url || PUBLIC_ROUTES.has(url)) return
    await tenantMiddleware(request, reply)
  })

  // ── Error handler ─────────────────────────────────────────────────────────────
  app.setErrorHandler(errorHandler)

  // ── Health check (PUBLIC — no tenant, no auth) ────────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'aesthera-api',
    env: appConfig.env,
  }))

  // ── Root (PUBLIC — returns API info so the Railway URL is human-friendly) ─────
  app.get('/', async () => ({
    name: 'aesthera-api',
    status: 'ok',
    version: '1.0.0',
    docs: '/health',
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
  await productsRoutes(app)
  await clinicalRoutes(app)
  await equipmentRoutes(app)
  await suppliesRoutes(app)
  await walletRoutes(app)

  return app
}
