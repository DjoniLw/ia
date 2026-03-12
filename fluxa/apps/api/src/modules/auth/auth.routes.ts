import { FastifyInstance } from 'fastify'
import { authController } from './auth.controller'
import { RegisterDto, LoginDto, RefreshTokenDto } from './auth.dto'
import { ValidationError } from '../../shared/errors/app-error'

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: RegisterDto }>('/auth/register', async (request, reply) => {
    try {
      const validated = RegisterDto.parse(request.body)
      request.body = validated
      await authController.register(request, reply)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        throw new ValidationError(JSON.stringify(err.flatten().fieldErrors))
      }
      throw err
    }
  })

  app.post<{ Body: LoginDto }>('/auth/login', async (request, reply) => {
    try {
      const validated = LoginDto.parse(request.body)
      request.body = validated
      await authController.login(request, reply)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        throw new ValidationError(JSON.stringify(err.flatten().fieldErrors))
      }
      throw err
    }
  })

  app.post<{ Body: RefreshTokenDto }>('/auth/refresh', async (request, reply) => {
    try {
      const validated = RefreshTokenDto.parse(request.body)
      request.body = validated
      await authController.refresh(request, reply)
    } catch (err: any) {
      if (err.name === 'ZodError') {
        throw new ValidationError(JSON.stringify(err.flatten().fieldErrors))
      }
      throw err
    }
  })

  app.post('/auth/logout', async (request, reply) => {
    await authController.logout(request, reply)
  })
}
