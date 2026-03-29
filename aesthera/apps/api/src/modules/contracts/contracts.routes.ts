import type { FastifyInstance } from 'fastify'
import { jwtClinicGuard } from '../../shared/guards/jwt-clinic.guard'
import { roleGuard } from '../../shared/guards/role.guard'
import {
  AssinafyWebhookDto,
  CreateContractTemplateDto,
  CreateCustomerContractDto,
  SendAssinafyDto,
  SendContractWhatsAppDto,
  SignManualDto,
  TemplatePresignDto,
  UpdateContractTemplateDto,
} from './contracts.dto'
import { ContractsService } from './contracts.service'

export async function contractsRoutes(app: FastifyInstance) {
  const svc = new ContractsService()

  // ── Templates ─────────────────────────────────────────────────────────────────

  /**
   * GET /contract-templates
   * Lista modelos de contrato da clínica.
   */
  app.get(
    '/contract-templates',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      return reply.send(await svc.listTemplates(req.clinicId))
    },
  )

  /**
   * POST /contract-templates
   * Cria novo modelo de contrato.
   */
  app.post(
    '/contract-templates',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = CreateContractTemplateDto.parse(req.body)
      return reply.status(201).send(await svc.createTemplate(req.clinicId, dto))
    },
  )

  /**
   * PATCH /contract-templates/:id
   * Atualiza modelo de contrato.
   */
  app.patch(
    '/contract-templates/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      const dto = UpdateContractTemplateDto.parse(req.body)
      return reply.send(await svc.updateTemplate(req.clinicId, id, dto))
    },
  )

  /**
   * DELETE /contract-templates/:id
   * Remove modelo de contrato (somente se não vinculado a contratos).
   */
  app.delete(
    '/contract-templates/:id',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const { id } = req.params as { id: string }
      await svc.deleteTemplate(req.clinicId, id)
      return reply.status(204).send()
    },
  )

  /**
   * POST /contract-templates/presign
   * Gera presigned URL para upload de arquivo do template.
   */
  app.post(
    '/contract-templates/presign',
    { preHandler: [jwtClinicGuard, roleGuard(['admin'])] },
    async (req, reply) => {
      const dto = TemplatePresignDto.parse(req.body)
      return reply.send(await svc.presignTemplate(req.clinicId, dto))
    },
  )

  // ── Customer Contracts ─────────────────────────────────────────────────────────

  /**
   * GET /customers/:customerId/contracts
   * Lista contratos de um cliente.
   */
  app.get(
    '/customers/:customerId/contracts',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      return reply.send(await svc.listCustomerContracts(req.clinicId, customerId))
    },
  )

  /**
   * POST /customers/:customerId/contracts
   * Vincula um modelo de contrato ao cliente (cria CustomerContract PENDING).
   */
  app.post(
    '/customers/:customerId/contracts',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId } = req.params as { customerId: string }
      const dto = CreateCustomerContractDto.parse(req.body)
      return reply.status(201).send(await svc.createCustomerContract(req.clinicId, customerId, dto))
    },
  )

  /**
   * POST /customers/:customerId/contracts/:id/send-assinafy
   * Envia contrato para assinatura via n8n → Assinafy.
   */
  app.post(
    '/customers/:customerId/contracts/:id/send-assinafy',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId, id } = req.params as { customerId: string; id: string }
      const dto = SendAssinafyDto.parse(req.body ?? {})
      const ip = req.ip
      return reply.send(await svc.sendAssinafy(req.clinicId, customerId, id, dto, ip))
    },
  )

  /**
   * POST /customers/:customerId/contracts/:id/sign-manual
   * Assina contrato manualmente (base64 do canvas).
   */
  app.post(
    '/customers/:customerId/contracts/:id/sign-manual',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId, id } = req.params as { customerId: string; id: string }
      const dto = SignManualDto.parse(req.body)
      const ip = req.ip
      return reply.send(await svc.signManual(req.clinicId, customerId, id, dto, ip))
    },
  )

  // ── Visualização e WhatsApp ───────────────────────────────────────────────────

  /**
   * GET /customers/:customerId/contracts/:id/view
   * Retorna URL temporária de visualização do arquivo do contrato
   * e assinatura registrada (se assinatura manual).
   */
  app.get(
    '/customers/:customerId/contracts/:id/view',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId, id } = req.params as { customerId: string; id: string }
      return reply.send(await svc.getContractView(req.clinicId, customerId, id))
    },
  )

  /**
   * POST /customers/:customerId/contracts/:id/send-whatsapp
   * Envia o link de assinatura do contrato via WhatsApp.
   */
  app.post(
    '/customers/:customerId/contracts/:id/send-whatsapp',
    { preHandler: [jwtClinicGuard, roleGuard(['admin', 'staff'])] },
    async (req, reply) => {
      const { customerId, id } = req.params as { customerId: string; id: string }
      const dto = SendContractWhatsAppDto.parse(req.body)
      return reply.send(await svc.sendContractWhatsApp(req.clinicId, customerId, id, dto))
    },
  )

  // ── Webhook (público) ────────────────────────────────────────────────────────

  /**
   * POST /contracts/webhooks/assinafy
   * Callback do Assinafy via n8n ao concluir assinatura.
   * Rota pública — autenticada por X-Webhook-Secret.
   */
  app.post(
    '/contracts/webhooks/assinafy',
    async (req, reply) => {
      const secret = (req.headers['x-webhook-secret'] as string) ?? undefined
      const dto = AssinafyWebhookDto.parse(req.body)
      const result = await svc.handleAssinafyWebhook(secret, dto)
      return reply.send(result)
    },
  )
}
