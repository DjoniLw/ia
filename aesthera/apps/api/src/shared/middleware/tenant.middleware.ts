import type { FastifyReply, FastifyRequest } from 'fastify'
import { redis } from '../../database/redis/client'
import { prisma } from '../../database/prisma/client'
import { TenantError, NotFoundError, ForbiddenError } from '../errors/app-error'

const CLINIC_SLUG_TTL = 300 // 5 minutes

/**
 * Tenant middleware — must run before any guard or controller.
 * Reads X-Clinic-Slug header, resolves clinic_id via Redis cache (or DB fallback),
 * and sets request.clinicId.
 *
 * Applied selectively to routes that require tenant context.
 * Public routes (health check, auth/register, payment page) do NOT use this middleware.
 */
export async function tenantMiddleware(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const slug = request.headers['x-clinic-slug'] as string | undefined

  if (!slug) {
    throw new TenantError('Missing X-Clinic-Slug header', 'MISSING_TENANT')
  }

  // 1. Check Redis cache first
  const cacheKey = `clinic:slug:${slug}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    request.clinicId = cached
    return
  }

  // 2. Fall back to database
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })

  if (!clinic) {
    throw new NotFoundError('Clinic')
  }

  if (clinic.status === 'cancelled') {
    throw new ForbiddenError('Clinic account has been cancelled')
  }

  if (clinic.status === 'suspended') {
    throw new ForbiddenError('Clinic account is suspended')
  }

  // 3. Cache for next requests
  await redis.setex(cacheKey, CLINIC_SLUG_TTL, clinic.id)
  request.clinicId = clinic.id
}

// ─── Fastify type augmentation ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    clinicId: string
  }
}
