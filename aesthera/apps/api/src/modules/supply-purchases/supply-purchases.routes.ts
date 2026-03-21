import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateSupplyPurchaseDto, ListSupplyPurchasesQuery } from './supply-purchases.dto'
import { supplyPurchasesService } from './supply-purchases.service'

export async function supplyPurchasesRoutes(app: FastifyInstance) {
  app.get('/supply-purchases', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListSupplyPurchasesQuery.parse(req.query)
    return reply.send(await supplyPurchasesService.list(req.clinicId, q))
  })

  app.get('/supply-purchases/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await supplyPurchasesService.get(req.clinicId, id))
  })

  app.post(
    '/supply-purchases',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateSupplyPurchaseDto.parse(req.body)
      return reply.code(201).send(await supplyPurchasesService.create(req.clinicId, dto))
    },
  )

  app.delete(
    '/supply-purchases/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await supplyPurchasesService.delete(req.clinicId, id))
    },
  )
}