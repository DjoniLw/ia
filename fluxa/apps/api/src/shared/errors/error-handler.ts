import { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { AppError } from './app-error'
import { logger } from '../logger/logger'

export function errorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Zod validation errors
  if (error instanceof ZodError) {
    reply.status(422).send({
      error: 'VALIDATION_ERROR',
      message: 'Validation failed',
      details: error.flatten().fieldErrors,
    })
    return
  }

  // Custom app errors
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      error: error.code ?? 'APP_ERROR',
      message: error.message,
    })
    return
  }

  // Fastify errors (e.g. 404 route not found)
  const fastifyError = error as FastifyError
  if (fastifyError.statusCode) {
    reply.status(fastifyError.statusCode).send({
      error: fastifyError.code ?? 'FASTIFY_ERROR',
      message: fastifyError.message,
    })
    return
  }

  // Unexpected errors
  logger.error({ err: error }, 'Unhandled error')
  reply.status(500).send({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  })
}
