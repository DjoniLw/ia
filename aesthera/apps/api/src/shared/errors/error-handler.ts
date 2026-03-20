import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'
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
      ...(error.data ? { data: error.data } : {}),
    })
    return
  }

  // Prisma known request errors (e.g. unique constraint, record not found)
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        reply.status(409).send({
          error: 'CONFLICT',
          message: 'A record with this data already exists.',
        })
        return
      case 'P2025':
        reply.status(404).send({
          error: 'NOT_FOUND',
          message: 'Record not found.',
        })
        return
      case 'P2021':
        logger.error({ err: error }, 'Database table not found — schema may not be initialized')
        reply.status(503).send({
          error: 'DATABASE_NOT_READY',
          message: 'Database is not set up. Please contact support.',
        })
        return
      case 'P2022':
        logger.error({ err: error }, 'Database column not found — schema may be out of date')
        reply.status(503).send({
          error: 'DATABASE_NOT_READY',
          message: 'Database schema is out of date. Please contact support.',
        })
        return
      default:
        logger.error({ err: error, code: error.code }, 'Prisma request error')
        reply.status(400).send({
          error: 'DATABASE_ERROR',
          message: 'A database error occurred.',
        })
        return
    }
  }

  // Prisma initialization/connection errors
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    error instanceof Prisma.PrismaClientRustPanicError
  ) {
    logger.error({ err: error }, 'Prisma client error')
    reply.status(503).send({
      error: 'DATABASE_UNAVAILABLE',
      message: 'Database is currently unavailable. Please try again later.',
    })
    return
  }

  // Redis / ioredis connection errors (MaxRetriesPerRequestError, AbortError)
  // These are thrown when the Redis server is unreachable or the request is
  // aborted after exhausting retries. name-based check avoids importing the
  // transitive redis-errors package directly.
  if (error.name === 'MaxRetriesPerRequestError' || error.name === 'AbortError') {
    logger.error({ err: error }, 'Redis unavailable')
    reply.status(503).send({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Authentication service is temporarily unavailable. Please try again later.',
    })
    return
  }

  // Fastify errors (e.g. 404 route not found, rate limit)
  const fastifyError = error as FastifyError
  if (fastifyError.statusCode) {
    reply.status(fastifyError.statusCode).send({
      error: fastifyError.code ?? 'FASTIFY_ERROR',
      message: fastifyError.message,
    })
    return
  }

  // Unexpected errors — do not leak internals
  logger.error({ err: error }, 'Unhandled error')
  reply.status(500).send({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'An unexpected error occurred',
  })
}
