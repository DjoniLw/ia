import type { FastifyInstance } from 'fastify'
import { generateId } from '../utils/id'

export function registerRequestId(app: FastifyInstance): void {
  app.addHook('onRequest', async (request) => {
    request.id = (request.headers['x-request-id'] as string) ?? generateId()
  })
}
