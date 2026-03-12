import { FastifyRequest, FastifyReply } from 'fastify'
import { authService } from './auth.service'
import { RegisterDto, LoginDto, RefreshTokenDto } from './auth.dto'

export class AuthController {
  async register(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as RegisterDto

    const result = await authService.register(body.name, body.email, body.document, body.password)

    reply.status(201).send({
      companyId: result.companyId,
      email: result.email,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    })
  }

  async login(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as LoginDto

    const result = await authService.login(body.email, body.password)

    reply.status(200).send({
      companyId: result.companyId,
      email: result.email,
      accessToken: result.tokens.accessToken,
      refreshToken: result.tokens.refreshToken,
    })
  }

  async refresh(request: FastifyRequest, reply: FastifyReply) {
    const body = request.body as RefreshTokenDto

    const tokens = await authService.refreshToken(body.refreshToken)

    reply.status(200).send({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    })
  }

  async logout(_request: FastifyRequest, reply: FastifyReply) {
    reply.status(200).send({
      message: 'Logged out successfully',
    })
  }
}

export const authController = new AuthController()
