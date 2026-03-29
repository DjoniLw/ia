import crypto from 'node:crypto'
import path from 'node:path'
import { appConfig } from '../../config/app.config'
import { generatePresignedPutUrl, generatePresignedGetUrl } from '../../integrations/r2/r2.service'
import { NotificationsService } from '../notifications/notifications.service'
import {
  AppError,
  ConflictError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type {
  AssinafyWebhookDto,
  ConfirmSignedUploadDto,
  ConfirmStandaloneSignedDto,
  CreateContractTemplateDto,
  CreateCustomerContractDto,
  PresignSignedContractDto,
  PresignStandaloneSignedDto,
  SendAssinafyDto,
  SendContractWhatsAppDto,
  SignManualDto,
  TemplatePresignDto,
  UpdateContractTemplateDto,
} from './contracts.dto'
import { ContractsRepository } from './contracts.repository'

export class ContractsService {
  private repo = new ContractsRepository()

  // ── Templates ────────────────────────────────────────────────────────────────

  async listTemplates(clinicId: string) {
    return this.repo.findAllTemplates(clinicId)
  }

  async createTemplate(clinicId: string, dto: CreateContractTemplateDto) {
    return this.repo.createTemplate(clinicId, dto)
  }

  async updateTemplate(clinicId: string, id: string, dto: UpdateContractTemplateDto) {
    const tpl = await this.repo.findTemplateById(clinicId, id)
    if (!tpl) throw new NotFoundError('ContractTemplate')

    // Não permitir desativar template com contratos pendentes
    if (dto.active === false) {
      const pending = await prisma.customerContract.count({
        where: { templateId: id, clinicId, status: 'pending', deletedAt: null },
      })
      if (pending > 0) {
        throw new ConflictError(
          'Não é possível desativar este modelo enquanto há contratos pendentes vinculados.',
        )
      }
    }

    return this.repo.updateTemplate(clinicId, id, dto)
  }

  async deleteTemplate(clinicId: string, id: string) {
    const tpl = await this.repo.findTemplateById(clinicId, id)
    if (!tpl) throw new NotFoundError('ContractTemplate')

    const linked = await prisma.customerContract.count({
      where: { templateId: id, clinicId, deletedAt: null },
    })
    if (linked > 0) {
      throw new ConflictError(
        'Não é possível excluir este modelo pois há contratos vinculados a ele.',
      )
    }

    return this.repo.deleteTemplate(clinicId, id)
  }

  /**
   * Presign para upload de arquivo do template diretamente ao R2.
   */
  async presignTemplate(clinicId: string, dto: TemplatePresignDto) {
    const ext = path.extname(dto.fileName).toLowerCase() || '.pdf'
    const storageKey = `templates/${clinicId}/${crypto.randomUUID()}${ext}`
    const presignedUrl = await generatePresignedPutUrl(storageKey, dto.mimeType, 3600)
    return { storageKey, presignedUrl }
  }

  // ── Customer Contracts ────────────────────────────────────────────────────────

  async listCustomerContracts(clinicId: string, customerId: string) {
    // Garantir que o cliente pertence à clínica (proteção cross-tenant)
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    return this.repo.findContractsByCustomer(clinicId, customerId)
  }

  async createCustomerContract(
    clinicId: string,
    customerId: string,
    dto: CreateCustomerContractDto,
  ) {
    // Verificar cliente
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    // Verificar template ativo
    const tpl = await this.repo.findTemplateById(clinicId, dto.templateId)
    if (!tpl) throw new NotFoundError('ContractTemplate')
    if (!tpl.active) {
      throw new AppError('Este modelo de contrato está inativo.', 400, 'TEMPLATE_INACTIVE')
    }

    return this.repo.createContract(clinicId, customerId, dto)
  }

  /**
   * Envia contrato para assinatura via n8n → Assinafy.
   * Requer N8N_CONTRACTS_WEBHOOK_URL configurado.
   */
  async sendAssinafy(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: SendAssinafyDto,
    _actorIp?: string,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    const webhookUrl = appConfig.contracts.n8nWebhookUrl
    if (!webhookUrl) {
      throw new AppError(
        'Integração com Assinafy não configurada. Configure N8N_CONTRACTS_WEBHOOK_URL.',
        503,
        'ASSINAFY_NOT_CONFIGURED',
      )
    }

    // Buscar dados do cliente para enviar ao n8n
    const customer = await prisma.customer.findFirst({ where: { id: customerId, clinicId } })
    const clinic = await prisma.clinic.findFirst({ where: { id: clinicId } })

    const payload = {
      contractId: contract.id,
      customerName: customer?.name ?? '',
      customerEmail: dto.customerEmail ?? customer?.email ?? '',
      templateName: contract.template?.name ?? '',
      clinicName: clinic?.name ?? '',
    }

    // Chamar n8n webhook
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new AppError(
        'Falha ao enviar contrato para assinatura. Verifique a integração com n8n.',
        502,
        'N8N_WEBHOOK_FAILED',
      )
    }

    const result = await response.json().catch(() => ({})) as {
      signLink?: string
      externalId?: string
    }

    // Persistir link de assinatura
    const updated = await this.repo.updateContract(contract.id, {
      signatureMode: 'assinafy',
      signLink: result.signLink ?? null,
      externalId: result.externalId ?? null,
      sentAt: new Date(),
    })

    return updated
  }

  /**
   * Assina o contrato manualmente (base64 da assinatura desenhada na tela).
   */
  async signManual(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: SignManualDto,
    signerIp?: string,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    const updated = await this.repo.updateContract(contract.id, {
      status: 'signed',
      signatureMode: 'manual',
      signature: dto.signature,
      signedAt: new Date(),
      signerIp: signerIp ?? null,
    })

    return updated
  }

  /**
   * Callback do Assinafy via n8n — marca o contrato como assinado.
   */
  async handleAssinafyWebhook(secret: string | undefined, dto: AssinafyWebhookDto) {
    const expected = appConfig.contracts.webhookSecret
    if (expected && secret !== expected) {
      throw new UnauthorizedError('Webhook secret inválido.')
    }

    const contract = await prisma.customerContract.findFirst({
      where: { id: dto.contractId, deletedAt: null },
    })
    if (!contract) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') return contract // idempotente

    const updated = await this.repo.updateContract(contract.id, {
      status: 'signed',
      externalId: dto.externalId ?? contract.externalId,
      signedAt: new Date(dto.signedAt),
      signedPdfKey: dto.signedPdfUrl ?? null,
    })

    return updated
  }

  /**
   * Retorna URL temporária de visualização do arquivo do contrato
   * e assinatura (se assinado manualmente).
   */
  async getContractView(clinicId: string, customerId: string, contractId: string) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    let fileUrl: string | null = null
    if (contract.template?.storageKey) {
      fileUrl = await generatePresignedGetUrl(contract.template.storageKey, 3600)
    }

    let signedFileUrl: string | null = null
    if (contract.status === 'signed' && contract.signedPdfKey) {
      signedFileUrl = await generatePresignedGetUrl(contract.signedPdfKey, 3600)
    }

    return {
      id: contract.id,
      status: contract.status,
      signatureMode: contract.signatureMode,
      signedAt: contract.signedAt,
      fileUrl,
      signedFileUrl,
      signature:
        contract.signatureMode === 'manual' && contract.status === 'signed'
          ? contract.signature
          : null,
    }
  }

  /**
   * Envia o link de assinatura do contrato via WhatsApp (Z-API).
   */
  async sendContractWhatsApp(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: SendContractWhatsAppDto,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (!contract.signLink) {
      throw new AppError(
        'Este contrato não possui link de assinatura. Envie via Assinafy primeiro para gerar o link.',
        400,
        'NO_SIGN_LINK',
      )
    }

    const customer = await prisma.customer.findFirst({ where: { id: customerId, clinicId } })
    const customerName = customer?.name ?? 'Cliente'

    const message = `Olá, ${customerName}! 👋\n\nSegue o link para assinar o contrato *${contract.template?.name ?? contract.label ?? 'contrato'}*:\n\n${contract.signLink}`

    const notificationsService = new NotificationsService()
    await notificationsService.sendWhatsApp({
      clinicId,
      phone: dto.phone,
      message,
      event: 'contract.sign_link',
      customerId,
    })

    return { sent: true }
  }

  /**
   * Gera presigned PUT URL para upload de contrato já assinado (impresso/escaneado).
   */
  async presignSignedContract(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: PresignSignedContractDto,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    const ext = path.extname(dto.fileName).toLowerCase() || '.pdf'
    const storageKey = `signed-contracts/${clinicId}/${customerId}/${crypto.randomUUID()}${ext}`
    const presignedUrl = await generatePresignedPutUrl(storageKey, dto.mimeType, 3600)
    return { storageKey, presignedUrl }
  }

  /**
   * Confirma o upload do contrato assinado e marca o contrato como assinado.
   */
  async confirmSignedUpload(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: ConfirmSignedUploadDto,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    return this.repo.updateContract(contract.id, {
      status: 'signed',
      signatureMode: 'uploaded',
      signedPdfKey: dto.storageKey,
      signedAt: new Date(),
    })
  }

  /**
   * Gera presigned PUT URL para upload avulso (sem template vinculado).
   */
  async presignStandaloneSigned(
    clinicId: string,
    customerId: string,
    dto: PresignStandaloneSignedDto,
  ) {
    // Verificar se o cliente pertence à clínica
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    const ext = path.extname(dto.fileName).toLowerCase() || '.pdf'
    const storageKey = `signed-contracts/${clinicId}/${customerId}/${crypto.randomUUID()}${ext}`
    const presignedUrl = await generatePresignedPutUrl(storageKey, dto.mimeType, 3600)
    return { storageKey, presignedUrl }
  }

  /**
   * Confirma upload avulso e cria o registro CustomerContract já assinado,
   * sem vínculo com um template.
   */
  async confirmStandaloneSigned(
    clinicId: string,
    customerId: string,
    dto: ConfirmStandaloneSignedDto,
  ) {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    return prisma.customerContract.create({
      data: {
        clinicId,
        customerId,
        templateId: null,
        label: dto.label,
        status: 'signed',
        signatureMode: 'uploaded',
        signedPdfKey: dto.storageKey,
        signedAt: new Date(),
      },
      include: { template: { select: { name: true, storageKey: true } } },
    })
  }
}
