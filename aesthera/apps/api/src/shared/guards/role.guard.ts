import type { FastifyReply, FastifyRequest } from 'fastify'
import { ForbiddenError } from '../errors/app-error'

type AllowedRole = 'admin' | 'staff' | 'professional'

/**
 * Role-based access guard. Use after jwtClinicGuard.
 *
 * @example
 * // Admin-only route
 * app.delete('/clinics/me', { preHandler: [jwtClinicGuard, roleGuard(['admin'])] }, handler)
 */
export function roleGuard(allowedRoles: AllowedRole[]) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    if (!allowedRoles.includes(request.user.role as AllowedRole)) {
      throw new ForbiddenError('Insufficient permissions')
    }
  }
}
