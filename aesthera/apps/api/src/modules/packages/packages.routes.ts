import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreatePackageDto,
  ListCustomerPackagesQuery,
  ListPackagesQuery,
  ListSoldPackagesQuery,
  PurchasePackageDto,
  RedeemSessionDto,
  UpdatePackageDto,
} from './packages.dto'
import { PackagesService } from './packages.service'

export async function packagesRoutes(app: FastifyInstance) {
  const svc = new PackagesService()

  app.get('/packages', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListPackagesQuery.parse(req.query)
    return reply.send(await svc.listPackages(req.clinicId, q))
  })

  app.post(
    '/packages',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreatePackageDto.parse(req.body)
      return reply.status(201).send(await svc.createPackage(req.clinicId, dto))
    },
  )

  // Listagem admin de todos os pacotes vendidos (acesso restrito a admin)
  app.get(
    '/packages/sold',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const q = ListSoldPackagesQuery.parse(req.query)
      return reply.send(await svc.listSoldPackages(req.clinicId, q))
    },
  )

  app.get(
    '/packages/customer/:customerId',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const q = ListCustomerPackagesQuery.parse(req.query)
      return reply.send(await svc.listCustomerPackages(req.clinicId, customerId, q))
    },
  )

  app.get('/packages/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.getPackage(req.clinicId, id))
  })

  app.patch(
    '/packages/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdatePackageDto.parse(req.body)
      return reply.send(await svc.updatePackage(req.clinicId, id, dto))
    },
  )

  // Venda de pacote com cobrança pré-paga (BLOCO 2)
  app.post(
    '/packages/:id/purchase',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = PurchasePackageDto.parse(req.body)
      const idempotencyKey = (req.headers['idempotency-key'] as string) || crypto.randomUUID()
      return reply.status(201).send(await svc.purchasePackage(req.clinicId, id, dto, idempotencyKey))
    },
  )

  app.post(
    '/packages/sessions/:sessionId/redeem',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { sessionId } = req.params as { sessionId: string }
      const dto = RedeemSessionDto.parse(req.body ?? {})
      return reply.send(await svc.redeemSession(req.clinicId, sessionId, dto.appointmentId))
    },
  )
}
