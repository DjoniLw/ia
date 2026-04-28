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
import { roomsRoutes } from './modules/rooms/rooms.routes'
import { suppliesRoutes } from './modules/supplies/supplies.routes'
import { supplyPurchasesRoutes } from './modules/supply-purchases/supply-purchases.routes'
import { walletRoutes } from './modules/wallet/wallet.routes'
import { promotionsRoutes } from './modules/promotions/promotions.routes'
import { packagesRoutes } from './modules/packages/packages.routes'
import { accountsPayableRoutes } from './modules/accounts-payable/accounts-payable.routes'
import { manualReceiptsRoutes } from './modules/manual-receipts/manual-receipts.routes'
import { uploadsRoutes } from './modules/uploads/uploads.routes'
import { bodyMeasurementsRoutes } from './modules/body-measurements/body-measurements.routes'
import { measurementSheetsRoutes } from './modules/measurement-sheets/measurement-sheets.routes'
import { measurementSessionsRoutes } from './modules/measurement-sessions/measurement-sessions.routes'
import { contractsRoutes } from './modules/contracts/contracts.routes'
import { anamnesisRoutes } from './modules/anamnesis/anamnesis.routes'
import { customerPhotosRoutes } from './modules/customer-photos/customer-photos.controller'
import { PUBLIC_ROUTES } from './shared/constants/public-routes'
import './domain-event-handlers'

export async function buildApp(): Promise<FastifyInstance> {
  // Guard: recusa inicialização em produção com CORS aberto (wildcard).
  // appConfig.cors.origin === true é o equivalente a CORS_ORIGIN='*' no Fastify.
  if (appConfig.isProduction && appConfig.cors.origin === true) {
    console.error(
      '❌ CORS_ORIGIN deve ser configurado explicitamente em produção. Recusando inicialização.',
    )
    process.exit(1)
  }

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
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Clinic-Slug', 'X-Request-Id', 'Idempotency-Key'],
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
  // PUBLIC_ROUTES is defined in src/shared/constants/public-routes.ts — edit there.
  app.addHook('preHandler', async (request, reply) => {
    // routeOptions.url is an empty string when no route was matched (Fastify
    // still runs preHandler hooks for its built-in not-found handler).
    // Bail out in that case so Fastify returns a normal 404 instead of
    // MISSING_TENANT.
    const url = request.routeOptions.url
    if (!url || PUBLIC_ROUTES.has(url)) return
    // /pay/:token usa URL dinâmica — acessível sem X-Clinic-Slug (token-based)
    if (url.startsWith('/pay/')) return
    // /public/sign/:token é rota pública de assinatura remota (token-based)
    if (url.startsWith('/public/sign/')) return
    // /public/anamnese/:token é rota pública de anamnese (token-based)
    if (url.startsWith('/public/anamnese/')) return
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
  await roomsRoutes(app)
  await suppliesRoutes(app)
  await supplyPurchasesRoutes(app)
  await walletRoutes(app)
  await promotionsRoutes(app)
  await packagesRoutes(app)
  await accountsPayableRoutes(app)
  await manualReceiptsRoutes(app)
  await uploadsRoutes(app)
  await bodyMeasurementsRoutes(app)
  await measurementSheetsRoutes(app)
  await measurementSessionsRoutes(app)
  await contractsRoutes(app)
  await anamnesisRoutes(app)
  await customerPhotosRoutes(app)

  return app
}
