import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  AssignServicesDto,
  CreateProfessionalDto,
  ListProfessionalsQuery,
  SetWorkingHoursDto,
  UpdateProfessionalDto,
} from './professionals.dto'
import { ProfessionalsService } from './professionals.service'

export async function professionalsRoutes(app: FastifyInstance) {
  const svc = new ProfessionalsService()

  app.get('/professionals', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const q = ListProfessionalsQuery.parse(req.query)
    return reply.send(await svc.list(req.clinicId, q))
  })

  app.get('/professionals/:id', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    return reply.send(await svc.get(req.clinicId, id))
  })

  app.post(
    '/professionals',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateProfessionalDto.parse(req.body)
      return reply.status(201).send(await svc.create(req.clinicId, dto))
    },
  )

  app.patch(
    '/professionals/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateProfessionalDto.parse(req.body)
      return reply.send(await svc.update(req.clinicId, id, dto))
    },
  )

  app.delete(
    '/professionals/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.delete(req.clinicId, id))
    },
  )

  // Working hours
  app.get(
    '/professionals/:id/working-hours',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.getWorkingHours(req.clinicId, id))
    },
  )

  app.put(
    '/professionals/:id/working-hours',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = SetWorkingHoursDto.parse(req.body)
      return reply.send(await svc.setWorkingHours(req.clinicId, id, dto))
    },
  )

  // Services assignment
  app.get(
    '/professionals/:id/services',
    { preHandler: [jwtClinicGuard] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.getServices(req.clinicId, id))
    },
  )

  app.put(
    '/professionals/:id/services',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = AssignServicesDto.parse(req.body)
      return reply.send(await svc.assignServices(req.clinicId, id, dto))
    },
  )
}
