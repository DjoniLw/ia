import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  ApplyPromotionDto,
  CreatePromotionDto,
  ListPromotionsQuery,
  UpdatePromotionDto,
  ValidatePromotionDto,
} from './promotions.dto'
import { PromotionsService } from './promotions.service'

export async function promotionsRoutes(app: FastifyInstance) {
  const svc = new PromotionsService()

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

  app.post('/promotions/validate', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const dto = ValidatePromotionDto.parse(req.body)
    const result = await svc.validate(req.clinicId, dto.code, dto.billingAmount, dto.serviceIds)
    return reply.send({ discountAmount: result.discountAmount })
  })

  app.post(
    '/promotions/apply',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const base = ApplyPromotionDto.parse(req.body)
      const extra = req.body as { billingAmount: number; serviceIds?: string[] }
      return reply.send(
        await svc.apply(req.clinicId, {
          ...base,
          billingAmount: extra.billingAmount,
          serviceIds: extra.serviceIds,
        }),
      )
    },
  )
}
