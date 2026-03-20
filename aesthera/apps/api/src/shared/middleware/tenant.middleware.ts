import type { FastifyReply, FastifyRequest } from 'fastify'
import { redis } from '../../database/redis/client'
import { prisma } from '../../database/prisma/client'
import { TenantError, NotFoundError, ForbiddenError } from '../errors/app-error'

const CLINIC_SLUG_TTL = 300 // 5 minutes

// Shape stored in Redis for slug → clinic resolution
interface SlugCache {
  clinicId: string
  status: string
}

/**
 * Tenant middleware — must run before any guard or controller.
 * Reads X-Clinic-Slug header, resolves clinic_id via Redis cache (or DB fallback),
 * and sets request.clinicId.
 *
 * The cache stores both clinicId and status so that suspended/cancelled clinics
 * are rejected without waiting for the 5-min TTL to expire.
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
    throw new TenantError(
      'Header X-Clinic-Slug não encontrado. Acesse via subdomínio da clínica ou informe o slug no login.',
      'MISSING_TENANT',
    )
  }

  // 1. Check Redis cache first
  const cacheKey = `clinic:slug:${slug}`
  const cached = await redis.get(cacheKey)

  if (cached) {
    const { clinicId, status } = JSON.parse(cached) as SlugCache
    if (status === 'cancelled') {
      throw new ForbiddenError('Esta clínica foi encerrada e não pode mais ser acessada.')
    }
    if (status === 'suspended') {
      throw new ForbiddenError('Esta clínica está temporariamente suspensa. Entre em contato com o suporte.')
    }
    request.clinicId = clinicId
    return
  }

  // 2. Fall back to database
  const clinic = await prisma.clinic.findUnique({
    where: { slug },
    select: { id: true, status: true },
  })

  if (!clinic) {
    throw new NotFoundError(`Clínica com slug "${slug}" não encontrada`)
  }

  if (clinic.status === 'cancelled') {
    throw new ForbiddenError('Esta clínica foi encerrada e não pode mais ser acessada.')
  }

  if (clinic.status === 'suspended') {
    throw new ForbiddenError('Esta clínica está temporariamente suspensa. Entre em contato com o suporte.')
  }

  // 3. Cache for next requests (include status so cache hits also enforce status)
  const payload: SlugCache = { clinicId: clinic.id, status: clinic.status }
  await redis.setex(cacheKey, CLINIC_SLUG_TTL, JSON.stringify(payload))
  request.clinicId = clinic.id
}

// ─── Fastify type augmentation ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    clinicId: string
  }
}
