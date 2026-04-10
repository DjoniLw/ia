import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  CreateAnamnesisRequestDto,
  ListAnamnesisRequestsQuery,
  PublicRequestCorrectionDto,
  PublicSubmitAnamnesisDto,
  ResendAnamnesisDto,
  ResolveDiffSchema,
  SendAnamnesisDto,
  UpdateAnamnesisStaffAnswersDto,
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
   * GET /anamnesis-requests/:id/signature
   * Gera uma presigned GET URL temporária (1h) para visualização da assinatura.
   */
  app.get(
    '/anamnesis-requests/:id/signature',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const url = await svc.getSignatureUrl(req.clinicId, id)
      return reply.send({ url })
    },
  )

  /**
   * POST /anamnesis-requests/:id/resend
   * Gera novo token e reenvia o link ao paciente.
   */
  app.post(
    '/anamnesis-requests/:id/resend',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])], config: { rateLimit: { max: 3, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = ResendAnamnesisDto.parse(req.body)
      return reply.send(await svc.resend(req.clinicId, id, dto))
    },
  )

  /**
   * DELETE /anamnesis-requests/:id
   * Cancela uma solicitação de anamnese pendente. Apenas admin (CA11).
   */
  app.delete(
    '/anamnesis-requests/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.cancel(req.clinicId, id)
      return reply.status(204).send()
    },
  )

  /**
   * POST /anamnesis-requests/:id/cancel
   * Alias REST semântico para cancelamento (idêntico ao DELETE).
   */
  app.post(
    '/anamnesis-requests/:id/cancel',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.cancel(req.clinicId, id)
      return reply.status(204).send()
    },
  )

  /**
   * POST /anamnesis-requests/:id/finalize
   * Finaliza o rascunho da clínica sem enviar ao cliente (DRAFT → CLINIC_FILLED).
   */
  app.post(
    '/anamnesis-requests/:id/finalize',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      return reply.send(await svc.finalize(req.clinicId, id))
    },
  )

  /**
   * POST /anamnesis-requests/:id/send
   * Envia ao cliente: gera signToken + consentText server-side.
   */
  app.post(
    '/anamnesis-requests/:id/send',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])], config: { rateLimit: { max: 5, timeWindow: '1 hour' } } },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = SendAnamnesisDto.parse(req.body)
      return reply.send(await svc.sendToClient(req.clinicId, id, dto))
    },
  )

  /**
   * PATCH /anamnesis-requests/:id
   * Atualiza as respostas da clínica em fichas com status clinic_filled.
   */
  app.patch(
    '/anamnesis-requests/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateAnamnesisStaffAnswersDto.parse(req.body)
      return reply.send(await svc.updateStaffAnswers(req.clinicId, id, dto))
    },
  )

  /**
   * POST /anamnesis-requests/:id/resolve-diff
   * Resolve divergências campo-a-campo e transiciona para SIGNED (atômico).
   */
  app.post(
    '/anamnesis-requests/:id/resolve-diff',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = ResolveDiffSchema.parse(req.body)
      return reply.send(await svc.resolveDiff(req.clinicId, id, dto, req.user.sub))
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
        { clientAnswers: dto.clientAnswers, signatureBase64: dto.signatureBase64, consentGiven: dto.consentGiven },
        { ipAddress: req.ip ?? null, userAgent },
      )
      return reply.send(result)
    },
  )

  /**
   * PATCH /public/anamnese/:token/request-correction
   * Paciente solicita correção de uma anamnese pendente.
   * Rota pública — autenticada apenas pelo token.
   */
  app.patch(
    '/public/anamnese/:token/request-correction',
    { config: { rateLimit: { max: 10, timeWindow: '15 minutes' } } },
    async (req, reply) => {
      const { token } = req.params as { token: string }
      PublicRequestCorrectionDto.parse(req.body)
      return reply.send(await svc.requestCorrection(token))
    },
  )
}
