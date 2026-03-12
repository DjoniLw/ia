import { FastifyReply, FastifyRequest } from 'fastify'
import { UnauthorizedError } from '../errors/app-error'

export async function jwtGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  try {
    await request.jwtVerify()
  } catch {
    throw new UnauthorizedError()
  }
}

export async function apiKeyGuard(request: FastifyRequest, _reply: FastifyReply): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined

  if (!apiKey) {
    throw new UnauthorizedError('API key is required')
  }

  // The actual validation (lookup in DB) is done inside the auth module
  // This guard just ensures the header is present
  request.apiKey = apiKey
}

// Augment FastifyRequest to include apiKey
declare module 'fastify' {
  interface FastifyRequest {
    apiKey?: string
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    user: {
      sub?: string
      companyId?: string
    }
  }
}
