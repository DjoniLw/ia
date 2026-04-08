import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateAnamnesisRequestDto,
  ListAnamnesisRequestsQuery,
  PublicRequestCorrectionDto,
  PublicSubmitAnamnesisDto,
  ResendAnamnesisDto,
} from './anamnesis.dto'
import { AnamnesisService } from './anamnesis.service'

export async function anamnesisRoutes(app: FastifyInstance) {
  const svc = new AnamnesisService()

  // ── Dashboard ─────────────────────────────────────────────────────────────────

  /**
   * GET /anamnesis-requests
   * Lista solicitações de anamnese da clínica.
   */
  app.get(
    '/anamnesis-requests',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const q = ListAnamnesisRequestsQuery.parse(req.query)
      return reply.send(await svc.list(req.clinicId, q))
    },
  )

  /**
   * POST /anamnesis-requests
   * Cria nova solicitação de anamnese e opcionalmente envia o link ao paciente.
   */
  app.post(
    '/anamnesis-requests',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const dto = CreateAnamnesisRequestDto.parse(req.body)
      const request = await svc.create(req.clinicId, req.user.sub, dto)
      return reply.status(201).send(request)
    },
  )

  /**
   * GET /anamnesis-requests/:id
   * Retorna uma solicitação de anamnese por ID.
   */
  app.get(
    '/anamnesis-requests/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.get(req.clinicId, id))
    },
  )

  /**
   * POST /anamnesis-requests/:id/resend
   * Gera novo token e reenvia o link ao paciente.
   */
  app.post(
    '/anamnesis-requests/:id/resend',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = ResendAnamnesisDto.parse(req.body)
      return reply.send(await svc.resend(req.clinicId, id, dto))
    },
  )

  /**
   * DELETE /anamnesis-requests/:id
   * Cancela uma solicitação de anamnese pendente.
   */
  app.delete(
    '/anamnesis-requests/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.cancel(req.clinicId, id)
      return reply.status(204).send()
    },
  )

  // ── Público ──────────────────────────────────────────────────────────────────

  /**
   * GET /public/anamnese/:token
   * Retorna os dados do formulário de anamnese para o paciente.
   * Rota pública — autenticada apenas pelo token.
   */
  app.get(
    '/public/anamnese/:token',
    { config: { rateLimit: { max: 30, timeWindow: '1 minute' } } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      return reply.send(await svc.getPublicInfo(token))
    },
  )

  /**
   * POST /public/anamnese/:token
   * Submete as respostas e a assinatura eletrônica do paciente.
   * Rota pública — limite estrito para evitar flood.
   */
  app.post(
    '/public/anamnese/:token',
    { config: { rateLimit: { max: 5, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      const dto = PublicSubmitAnamnesisDto.parse(req.body)
      const rawUserAgent = req.headers['user-agent']
      const userAgent = Array.isArray(rawUserAgent) ? rawUserAgent[0] : (rawUserAgent ?? null)
      const result = await svc.submit(
        token,
        { clientAnswers: dto.clientAnswers, signature: dto.signature, consentGiven: dto.consentGiven },
        { ipAddress: req.ip ?? null, userAgent },
      )
      return reply.send(result)
    },
  )

  /**
   * POST /public/anamnese/:token/correction
   * Paciente solicita correção de uma anamnese pendente.
   * Rota pública — autenticada apenas pelo token.
   */
  app.post(
    '/public/anamnese/:token/correction',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      PublicRequestCorrectionDto.parse(req.body)
      return reply.send(await svc.requestCorrection(token))
    },
  )
}
