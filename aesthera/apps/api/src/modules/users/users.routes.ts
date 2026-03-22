import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import { tenantMiddleware } from '../../shared/middleware/tenant.middleware'
import { AcceptInviteDto, InviteUserDto, UpdateMeDto, UpdateUserDto } from './users.dto'
import { UsersService } from './users.service'
import { createAuditLog } from '../../shared/audit'

export async function usersRoutes(app: FastifyInstance) {
  const service = new UsersService()

  // GET /users/me
  app.get('/users/me', { preHandler: [jwtClinicGuard] }, async (request, reply) => {
    const user = await service.getMe(request.clinicId, request.user.sub)
    return reply.send(user)
  })

  // PATCH /users/me
  app.patch('/users/me', { preHandler: [jwtClinicGuard] }, async (request, reply) => {
    const dto = UpdateMeDto.parse(request.body)
    const user = await service.updateMe(request.user.sub, dto)
    return reply.send(user)
  })

  // POST /users/accept-invite — public (no JWT, but needs tenant)
  app.post(
    '/users/accept-invite',
    { preHandler: [tenantMiddleware] },
    async (request, reply) => {
      const dto = AcceptInviteDto.parse(request.body)
      const result = await service.acceptInvite(request.clinicId, dto)
      return reply.send(result)
    },
  )

  // GET /users — admin only
  app.get(
    '/users',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const users = await service.listUsers(request.clinicId)
      return reply.send(users)
    },
  )

  // POST /users/invite — admin only
  app.post(
    '/users/invite',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const dto = InviteUserDto.parse(request.body)
      const result = await service.inviteUser(request.clinicId, dto)
      return reply.status(201).send(result)
    },
  )

  // GET /users/:id — admin only
  app.get(
    '/users/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const user = await service.getUser(request.clinicId, id)
      return reply.send(user)
    },
  )

  // PATCH /users/:id — admin only
  app.patch(
    '/users/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const dto = UpdateUserDto.parse(request.body)
      const user = await service.updateUser(request.clinicId, id, dto)

      // Audit log: registra especificamente mudança de role (ação sensível)
      if (dto.role !== undefined) {
        await createAuditLog({
          clinicId: request.clinicId,
          userId: request.user.sub,
          action: 'user.role_changed',
          entityId: id,
          metadata: { newRole: dto.role },
          ip: request.ip,
        })
      }

      return reply.send(user)
    },
  )

  // DELETE /users/:id — admin only
  app.delete(
    '/users/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const result = await service.deactivateUser(request.clinicId, id, request.user.sub)
      return reply.send(result)
    },
  )
}
