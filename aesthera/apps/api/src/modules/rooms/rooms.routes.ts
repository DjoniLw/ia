import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { CreateRoomDto, UpdateRoomDto, roomsService } from './rooms.service'

export async function roomsRoutes(app: FastifyInstance) {
  app.get('/rooms', { preHandler: [jwtClinicGuard] }, async (req, reply) => {
    return reply.send(await roomsService.list(req.clinicId))
  })

  app.post(
    '/rooms',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateRoomDto.parse(req.body)
      return reply.status(201).send(await roomsService.create(req.clinicId, dto))
    },
  )

  app.patch(
    '/rooms/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateRoomDto.parse(req.body)
      return reply.send(await roomsService.update(req.clinicId, id, dto))
    },
  )

  app.delete(
    '/rooms/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await roomsService.remove(req.clinicId, id))
    },
  )
}
