import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateEquipmentDto, UpdateEquipmentDto, equipmentService } from './equipment.service'

export async function equipmentRoutes(app: FastifyInstance) {
  app.get('/equipment', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    return reply.send(await equipmentService.list(req.clinicId))
  })

  app.post(
    '/equipment',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateEquipmentDto.parse(req.body)
      return reply.status(201).send(await equipmentService.create(req.clinicId, dto))
    },
  )

  app.patch(
    '/equipment/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateEquipmentDto.parse(req.body)
      return reply.send(await equipmentService.update(req.clinicId, id, dto))
    },
  )

  app.delete(
    '/equipment/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await equipmentService.remove(req.clinicId, id))
    },
  )
}
