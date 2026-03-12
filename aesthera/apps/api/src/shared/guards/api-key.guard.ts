import type { FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/app-error'
import { prisma } from '../../database/prisma/client'
import { createHash } from 'crypto'

/**
 * API Key guard for machine-to-machine integrations.
 * Reads Authorization: Bearer <key> or X-Api-Key: <key> header,
 * hashes it, and validates against the api_keys table.
 *
 * Requires tenant middleware to have run first (needs request.clinicId).
 */
export async function apiKeyGuard(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  const authHeader = request.headers.authorization
  const apiKeyHeader = request.headers['x-api-key'] as string | undefined

  const rawKey = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : apiKeyHeader

  if (!rawKey) {
    throw new UnauthorizedError('API key is required')
  }

  const keyHash = createHash('sha256').update(rawKey).digest('hex')

  const apiKey = await prisma.apiKey.findFirst({
    where: {
      clinicId: request.clinicId,
      keyHash,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    select: { id: true },
  })

  if (!apiKey) {
    throw new UnauthorizedError('Invalid or expired API key')
  }

  // Update last used timestamp (fire-and-forget)
  void prisma.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  })
}

// ─── Fastify type augmentation ────────────────────────────────────────────────

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyId?: string
  }
}
