import crypto from 'node:crypto'
import path from 'node:path'
import { appConfig } from '../../config/app.config'
import { generatePresignedPutUrl, generatePresignedGetUrl, getObjectBuffer } from '../../integrations/r2/r2.service'
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
  SendRemoteSignDto,
  SignManualDto,
  SignRemoteDto,
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
    signerUserAgent?: string,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    // Buscar CPF do cliente (snapshot no momento da assinatura)
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: { document: true },
    })

    // Calcular SHA-256 do PDF do template, se disponível
    let documentHash: string | null = null
    const templateStorageKey = contract.template?.storageKey
    if (templateStorageKey) {
      try {
        const pdfBuffer = await getObjectBuffer(templateStorageKey)
        if (pdfBuffer.length > 0) {
          documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
        } else {
          console.error(
            `[contracts] Buffer vazio ao obter documento do R2 (templateStorageKey=${templateStorageKey}, contractId=${contractId}). Hash não será calculado.`,
          )
        }
      } catch (err) {
        // Erro de infra (R2 indisponível) não deve bloquear a assinatura — registrar no log
        console.error(
          `[contracts] Falha ao calcular hash do documento (contractId=${contractId}):`,
          err,
        )
      }
    }

    const updated = await this.repo.updateContract(contract.id, {
      status: 'signed',
      signatureMode: 'manual',
      signature: dto.signature,
      signedAt: new Date(),
      signerIp: signerIp ?? null,
      signerUserAgent: signerUserAgent ?? null,
      signerCpf: customer?.document ?? null,
      documentHash,
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
        (contract.signatureMode === 'manual' || contract.signatureMode === 'remote') && contract.status === 'signed'
          ? contract.signature
          : null,
    }
  }

  /**
   * Retorna os dados de auditoria do contrato (somente para uso interno da clínica).
   */
  async getAuditTrail(clinicId: string, customerId: string, contractId: string) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    return {
      contractId: contract.id,
      status: contract.status,
      signatureMode: contract.signatureMode,
      signedAt: contract.signedAt,
      signerIp: contract.signerIp,
      signerUserAgent: contract.signerUserAgent,
      signerCpf: contract.signerCpf,
      documentHash: contract.documentHash,
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

  // ── Assinatura Remota por Link ─────────────────────────────────────────────────

  /**
   * Gera um token único de assinatura remota, persiste com TTL de 48 horas
   * e envia o link ao cliente via WhatsApp.
   */
  async generateSignToken(
    clinicId: string,
    customerId: string,
    contractId: string,
    dto: SendRemoteSignDto,
  ) {
    const contract = await this.repo.findContractById(clinicId, contractId)
    if (!contract) throw new NotFoundError('CustomerContract')
    if (contract.customerId !== customerId) throw new NotFoundError('CustomerContract')

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: { name: true },
    })
    if (!customer) throw new NotFoundError('Customer')

    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000)

    const updated = await this.repo.updateContract(contract.id, {
      signToken: token,
      signTokenExpiresAt: expiresAt,
    })

    const signUrl = `${appConfig.frontendUrl}/sign/${token}`
    const contractName = contract.label ?? contract.template?.name ?? 'contrato'

    const notificationsService = new NotificationsService()

    if (dto.phone) {
      const message = `Olá, ${customer.name}! 👋\n\nVocê recebeu um contrato para assinar: *${contractName}*.\n\nAcesse o link abaixo para ler e assinar diretamente pelo seu celular:\n\n${signUrl}\n\n_O link expira em 48 horas._`
      await notificationsService.sendWhatsApp({
        clinicId,
        phone: dto.phone,
        message,
        event: 'contract.remote_sign_link',
        customerId,
      })
    }

    if (dto.email) {
      await notificationsService.sendEmail({
        clinicId,
        email: dto.email,
        subject: `Contrato para assinar: ${contractName}`,
        htmlBody: `
<p>Olá, ${customer.name}!</p>
<p>Você recebeu um contrato para assinar: <strong>${contractName}</strong>.</p>
<p>Clique no botão abaixo para ler e assinar diretamente pelo seu dispositivo:</p>
<p style="margin:24px 0">
  <a href="${signUrl}" style="background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">
    Assinar contrato
  </a>
</p>
<p style="color:#888;font-size:12px">O link expira em 48 horas. Se não solicitou esta assinatura, ignore este e-mail.</p>`,
        event: 'contract.remote_sign_link',
        customerId,
      })
    }

    return updated
  }

  /**
   * Retorna informações públicas do contrato para exibição na página de assinatura remota.
   * NÃO requer autenticação — autenticado apenas pelo token.
   */
  async getPublicContractInfo(token: string) {
    const contract = await prisma.customerContract.findFirst({
      where: { signToken: token, deletedAt: null },
      include: {
        customer: { select: { name: true } },
        template: { select: { name: true, storageKey: true } },
      },
    })

    if (!contract) throw new AppError('Contrato não encontrado ou link inválido.', 404, 'PUBLIC_CONTRACT_NOT_FOUND')

    if (!contract.signTokenExpiresAt || contract.signTokenExpiresAt < new Date()) {
      throw new AppError('Este link de assinatura expirou.', 410, 'SIGN_TOKEN_EXPIRED')
    }

    if (contract.status === 'signed') {
      throw new AppError('Este contrato já foi assinado.', 409, 'ALREADY_SIGNED')
    }

    let fileUrl: string | null = null
    if (contract.template?.storageKey) {
      fileUrl = await generatePresignedGetUrl(contract.template.storageKey, 3600)
    }

    return {
      contractId: contract.id,
      contractName: contract.label ?? contract.template?.name ?? 'Contrato',
      customerName: contract.customer.name,
      fileUrl,
      expiresAt: contract.signTokenExpiresAt,
    }
  }

  /**
   * Efetua a assinatura remota do contrato via token público.
   * Valida o token, registra a assinatura e invalida o token (uso único).
   */
  async signRemote(
    token: string,
    dto: SignRemoteDto,
    signerIp?: string,
    signerUserAgent?: string,
  ) {
    const contract = await prisma.customerContract.findFirst({
      where: { signToken: token, deletedAt: null },
      include: {
        customer: { select: { document: true } },
        template: { select: { storageKey: true } },
      },
    })

    if (!contract) throw new AppError('Contrato não encontrado ou link inválido.', 404, 'PUBLIC_CONTRACT_NOT_FOUND')

    if (!contract.signTokenExpiresAt || contract.signTokenExpiresAt < new Date()) {
      throw new AppError('Este link de assinatura expirou.', 410, 'SIGN_TOKEN_EXPIRED')
    }

    if (contract.status === 'signed') {
      throw new ConflictError('Este contrato já foi assinado.')
    }

    // Calcular SHA-256 do PDF do template, se disponível
    let documentHash: string | null = null
    const templateStorageKey = contract.template?.storageKey
    if (templateStorageKey) {
      try {
        const pdfBuffer = await getObjectBuffer(templateStorageKey)
        if (pdfBuffer.length > 0) {
          documentHash = crypto.createHash('sha256').update(pdfBuffer).digest('hex')
        } else {
          console.error(
            `[contracts] Buffer vazio ao obter documento do R2 (templateStorageKey=${templateStorageKey}, contractId=${contract.id}). Hash não será calculado.`,
          )
        }
      } catch (err) {
        console.error(
          `[contracts] Falha ao calcular hash do documento (contractId=${contract.id}):`,
          err,
        )
      }
    }

    const updated = await this.repo.updateContract(contract.id, {
      status: 'signed',
      signatureMode: 'remote',
      signature: dto.signature,
      signedAt: new Date(),
      signerIp: signerIp ?? null,
      signerUserAgent: signerUserAgent ?? null,
      signerCpf: contract.customer?.document ?? null,
      documentHash,
      // Invalida o token após uso (token de uso único)
      signToken: null,
      signTokenExpiresAt: null,
    })

    return updated
  }
}
