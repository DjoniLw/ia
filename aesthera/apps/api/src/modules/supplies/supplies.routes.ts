import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { AssignSuppliesDto, CreateSupplyDto, ListSuppliesQuery, UpdateSupplyDto } from './supplies.dto'
import { suppliesService } from './supplies.service'

export async function suppliesRoutes(app: FastifyInstance) {
  // List supplies
  app.get('/supplies', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListSuppliesQuery.parse(req.query)
    return reply.send(await suppliesService.list(req.clinicId, q))
  })

  // Get single supply
  app.get('/supplies/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await suppliesService.get(req.clinicId, id))
  })

  // Create supply
  app.post(
    '/supplies',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateSupplyDto.parse(req.body)
      return reply.code(201).send(await suppliesService.create(req.clinicId, dto))
    },
  )

  // Update supply
  app.patch(
    '/supplies/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateSupplyDto.parse(req.body)
      return reply.send(await suppliesService.update(req.clinicId, id, dto))
    },
  )

  // Delete supply (soft)
  app.delete(
    '/supplies/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await suppliesService.delete(req.clinicId, id))
    },
  )

  // Get supplies assigned to a service
  app.get('/services/:serviceId/supplies', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { serviceId } = req.params as { serviceId: string }
    return reply.send(await suppliesService.getServiceSupplies(req.clinicId, serviceId))
  })

  // Assign supplies to a service (replaces all)
  app.put(
    '/services/:serviceId/supplies',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { serviceId } = req.params as { serviceId: string }
      const dto = AssignSuppliesDto.parse(req.body)
      await suppliesService.assignServiceSupplies(req.clinicId, serviceId, dto)
      return reply.send(await suppliesService.getServiceSupplies(req.clinicId, serviceId))
    },
  )
}
