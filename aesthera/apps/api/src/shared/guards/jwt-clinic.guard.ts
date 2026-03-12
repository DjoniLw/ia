import type { FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/app-error'

/**
 * Verifies the clinic JWT (admin or staff).
 * Must run AFTER tenant middleware since it uses request.clinicId
 * to ensure the token belongs to the resolved clinic.
 */
export async function jwtClinicGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError()
  }

  // Ensure token clinicId matches the resolved tenant
  if (request.user.clinicId !== request.clinicId) {
    throw new UnauthorizedError('Token does not match current clinic')
  }
}

/**
 * Verifies the professional JWT.
 * Professionals use a separate login flow with role = 'professional'.
 */
export async function jwtProfessionalGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError()
  }

  if (request.user.role !== 'professional') {
    throw new UnauthorizedError()
  }

  if (request.user.clinicId !== request.clinicId) {
    throw new UnauthorizedError('Token does not match current clinic')
  }
}

// ─── Fastify JWT type augmentation ───────────────────────────────────────────

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub: string
      clinicId: string
      role: 'admin' | 'staff' | 'professional'
    }
  }
}
