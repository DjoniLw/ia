import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  ApplyPromotionDto,
  CreatePromotionDto,
  ListPromotionsQuery,
  TogglePromotionStatusDto,
  UpdatePromotionDto,
  ValidatePromotionDto,
} from './promotions.dto'
import { PromotionsService } from './promotions.service'

const VALIDATE_RATE_LIMIT_WINDOW_MS = 60_000
const VALIDATE_RATE_LIMIT_MAX = 10

export async function promotionsRoutes(app: FastifyInstance) {
  const svc = new PromotionsService()

  // Per-IP in-memory counters for /validate rate limiting
  const validateHits = new Map<string, { count: number; resetAt: number }>()

  // Cleanup expired entries every 5 minutes to prevent unbounded memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now()
    for (const [ip, entry] of validateHits) {
      if (entry.resetAt < now) validateHits.delete(ip)
    }
  }, 5 * 60 * 1000)
  app.addHook('onClose', () => clearInterval(cleanupInterval))

  function checkValidateRateLimit(ip: string): { limited: boolean; retryAfter: number } {
    const now = Date.now()
    const entry = validateHits.get(ip)
    if (!entry || entry.resetAt < now) {
      validateHits.set(ip, { count: 1, resetAt: now + VALIDATE_RATE_LIMIT_WINDOW_MS })
      return { limited: false, retryAfter: 0 }
    }
    entry.count += 1
    if (entry.count > VALIDATE_RATE_LIMIT_MAX) {
      return { limited: true, retryAfter: Math.ceil((entry.resetAt - now) / 1000) }
    }
    return { limited: false, retryAfter: 0 }
  }

  app.get('/promotions', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListPromotionsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.post(
    '/promotions',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreatePromotionDto.parse(req.body)
      return reply.status(201).send(await svc.create(req.clinicId, dto))
    },
  )

  app.get('/promotions/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.patch(
    '/promotions/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdatePromotionDto.parse(req.body)
      return reply.send(await svc.update(req.clinicId, id, dto))
    },
  )

  app.patch(
    '/promotions/:id/status',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = TogglePromotionStatusDto.parse(req.body)
      return reply.send(await svc.toggleStatus(req.clinicId, id, dto))
    },
  )

  app.post(
    '/promotions/validate',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const ip = req.ip ?? 'unknown'
      const { limited, retryAfter } = checkValidateRateLimit(ip)
      if (limited) {
        return reply
          .status(429)
          .header('Retry-After', String(retryAfter))
          .send({ error: 'RATE_LIMIT_EXCEEDED', message: 'Muitas tentativas. Tente novamente em alguns instantes.' })
      }
      const dto = ValidatePromotionDto.parse(req.body)
      const result = await svc.validate(
        req.clinicId,
        dto.code,
        dto.billingAmount,
        dto.serviceIds,
        dto.customerId,
        false,
        dto.productIds,
      )
      return reply.send({ discountAmount: result.discountAmount })
    },
  )

  app.post(
    '/promotions/apply',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const base = ApplyPromotionDto.parse(req.body)
      const extra = req.body as { billingAmount: number; serviceIds?: string[]; customerId: string }
      return reply.send(
        await svc.apply(req.clinicId, {
          ...base,
          billingAmount: extra.billingAmount,
          serviceIds: extra.serviceIds,
          customerId: extra.customerId,
        }),
      )
    },
  )

  app.get(
    '/promotions/active-for-product/:productId',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { productId } = req.params as { productId: string }
      return reply.send(await svc.findActiveForProduct(req.clinicId, productId))
    },
  )

  app.get(
    '/promotions/active-for-service/:serviceId',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { serviceId } = req.params as { serviceId: string }
      const { customerId } = req.query as { customerId?: string }
      return reply.send(await svc.findActiveForService(req.clinicId, serviceId, customerId))
    },
  )
}
