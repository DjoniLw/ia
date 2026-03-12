import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateServiceDto, ListServicesQuery, UpdateServiceDto } from './services.dto'
import { ServicesService } from './services.service'

export async function servicesRoutes(app: FastifyInstance) {
  const service = new ServicesService()

  app.get('/services', { preHandler: [jwtClinicGuard] }, async (request, reply) => {
    const q = ListServicesQuery.parse(request.query)
    return reply.send(await service.list(request.clinicId, q))
  })

  app.get('/services/:id', { preHandler: [jwtClinicGuard] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    return reply.send(await service.get(request.clinicId, id))
  })

  app.post(
    '/services',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = CreateServiceDto.parse(request.body)
      return reply.status(201).send(await service.create(request.clinicId, dto))
    },
  )

  app.patch(
    '/services/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const dto = UpdateServiceDto.parse(request.body)
      return reply.send(await service.update(request.clinicId, id, dto))
    },
  )

  app.delete(
    '/services/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      return reply.send(await service.delete(request.clinicId, id))
    },
  )
}
