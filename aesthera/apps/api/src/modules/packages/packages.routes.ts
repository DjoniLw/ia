import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreatePackageDto,
  ListPackagesQuery,
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

  app.get('/packages/customer/:customerId', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { customerId } = req.params as { customerId: string }
    return reply.send(await svc.listCustomerPackages(req.clinicId, customerId))
  })

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

  app.post(
    '/packages/:id/purchase',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = PurchasePackageDto.parse(req.body)
      return reply.status(201).send(await svc.purchasePackage(req.clinicId, dto.customerId, id))
    },
  )

  app.post(
    '/packages/sessions/:sessionId/redeem',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { sessionId } = req.params as { sessionId: string }
      const dto = RedeemSessionDto.parse(req.body ?? {})
      return reply.send(await svc.redeemSession(req.clinicId, sessionId, dto.appointmentId))
    },
  )
}
