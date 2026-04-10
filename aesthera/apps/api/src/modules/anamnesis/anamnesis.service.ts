import crypto from 'node:crypto'
import { Prisma } from '@prisma/client'
import { appConfig } from '../../config/app.config'
import { prisma } from '../../database/prisma/client'
import { uploadBuffer } from '../../integrations/r2/r2.service'
import { ConflictError, GoneError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import { createDomainEvent } from '../../shared/events/domain-event'
import { eventBus } from '../../shared/events/event-bus'
import { logger } from '../../shared/logger/logger'
import { NotificationsService } from '../notifications/notifications.service'
import type { CreateAnamnesisRequestDto, ListAnamnesisRequestsQuery, ResendAnamnesisDto, ResolveDiffDto } from './anamnesis.dto'
import { AnamnesisRepository } from './anamnesis.repository'

// RN10: token expira em 7 dias
const TTL_DAYS = 7

/** SEC2 — select seguro para retorno da API (nunca vaza signToken, signatureUrl, consentText, ipAddress, userAgent) */
const safeAnamnesisSelect = {
  id: true,
  clinicId: true,
  customerId: true,
  mode: true,
  status: true,
  groupId: true,
  groupName: true,
  questionsSnapshot: true,
  staffAnswers: true,
  clientAnswers: true,
  diffResolution: true,
  signatureHash: true,
  consentGivenAt: true,
  signedAt: true,
  expiresAt: true,
  tokenExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const

function generateSignToken() {
  return crypto.randomBytes(32).toString('hex')
}

function buildExpiresAt() {
  const d = new Date()
  d.setDate(d.getDate() + TTL_DAYS)
  return d
}

function buildSignLink(token: string) {
  return `${appConfig.frontendUrl}/anamnese/${token}`
}

/** Gera o texto de consentimento LGPD incluindo dados da clínica (CA06/CA18). */
function buildConsentText(opts: {
  customerName: string
  groupName: string
  clinicName: string
  clinicDocument: string | null
}) {
  const clinicInfo = opts.clinicDocument
    ? `${opts.clinicName} (CNPJ ${opts.clinicDocument})`
    : opts.clinicName
  return (
    `Eu, ${opts.customerName}, declaro que as informações fornecidas são verdadeiras ` +
    `e consinto com o uso dos meus dados de saúde para finalidades clínicas por ${clinicInfo}, ` +
    `conforme a LGPD (Lei 13.709/2018). ` +
    `Ficha: "${opts.groupName}".`
  )
}

export class AnamnesisService {
  private repo = new AnamnesisRepository()
  private notifications = new NotificationsService()

  async create(clinicId: string, userId: string, data: CreateAnamnesisRequestDto) {
    const signToken = generateSignToken()
    const expiresAt = buildExpiresAt()
    const willSend = Boolean(data.phone || data.email)

    const request = await this.repo.create(clinicId, userId, {
      ...data,
      signToken,
      expiresAt,
      status: willSend ? 'sent_to_client' : undefined,
    })

    // Envio assíncrono — não bloqueia a resposta
    if (willSend) {
      // SEC2: signToken passado da variável local — não vem do objeto `request` (que não o expõe)
      this.#sendNotification(clinicId, { ...request, signToken }, { phone: data.phone, email: data.email }).catch((err) =>
        logger.error({ err, requestId: request.id }, 'Falha ao enviar notificação de anamnese'),
      )
    }

    // Nunca logar o signToken (CA17)
    logger.info({ clinicId, requestId: request.id }, 'AnamnesisRequest criada')

    return request
  }

  async list(clinicId: string, q: ListAnamnesisRequestsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const request = await this.repo.findById(clinicId, id)
    if (!request) throw new NotFoundError('AnamnesisRequest')
    return request
  }

  /** Endpoint público — retorna informações sem dados sensíveis do paciente para renderização do formulário. */
  async getPublicInfo(signToken: string) {
    const request = await this.repo.findByToken(signToken)
    if (!request) throw new NotFoundError('AnamnesisRequest')

    // SEC3: verificar expiração UNIVERSALMENTE — independente do status (prevenção TOCTOU)
    if (request.expiresAt < new Date()) {
      if (request.status === 'pending' || request.status === 'sent_to_client') {
        await this.repo.markExpired(request.clinicId, request.id)
      }
      throw new GoneError('Este link expirou. Entre em contato com a clínica para receber um novo link.')
    }

    if (request.status === 'expired') {
      throw new GoneError('Este link expirou. Entre em contato com a clínica para receber um novo link.')
    }

    if (request.status === 'signed' || request.status === 'client_submitted') {
      const signedAt = request.signedAt
      if (signedAt) {
        throw new ConflictError(`Esta ficha já foi preenchida e assinada em ${new Date(signedAt).toLocaleDateString('pt-BR')}.`)
      }
      throw new ConflictError('Esta anamnese já foi assinada.')
    }

    if (request.status === 'cancelled') {
      throw new GoneError('Este link de anamnese foi cancelado.')
    }

    return {
      id: request.id,
      clinicName: request.clinic.name,
      customerName: request.customer.name,
      mode: request.mode,
      groupName: request.groupName,
      questionsSnapshot: request.questionsSnapshot,
      staffAnswers: request.staffAnswers,
      expiresAt: request.expiresAt,
      // CA06/CA18: texto de consentimento gerado com dados da clínica para exibição e auditoria
      consentText: buildConsentText({
        customerName: request.customer.name,
        groupName: request.groupName,
        clinicName: request.clinic.name,
        clinicDocument: (request.clinic as { document?: string | null }).document ?? null,
      }),
    }
  }

  /** Submete os dados e a assinatura do paciente. */
  async submit(
    signToken: string,
    data: {
      clientAnswers: Record<string, string>
      signatureBase64: string
      consentGiven: true
      // ⛔ consentText: NUNCA aceito do body — SEC1/RN17
    },
    meta: { ipAddress: string | null; userAgent: string | null },
  ) {
    // Buscar dados completos ANTES de submeter para compor o evento
    const request = await this.repo.findByToken(signToken)
    if (!request) throw new NotFoundError('AnamnesisRequest')

    // SEC3: expiração verificada novamente no POST (prevenção TOCTOU)
    if (request.expiresAt < new Date()) {
      if (request.status === 'pending' || request.status === 'sent_to_client') {
        await this.repo.markExpired(request.clinicId, request.id)
      }
      throw new GoneError('Este link expirou. Entre em contato com a clínica para receber um novo link.')
    }

    if (request.status !== 'pending' && request.status !== 'sent_to_client' && request.status !== 'correction_requested') {
      throw new ConflictError('Esta anamnese não está disponível para preenchimento.')
    }

    const signatureHash = crypto
      .createHash('sha256')
      .update(data.signatureBase64)
      .digest('hex')

    // SEC1: consentText gerado server-side — IGNORAR qualquer valor do body
    const consentText = buildConsentText({
      customerName: request.customer.name,
      groupName: request.groupName,
      clinicName: request.clinic.name,
      clinicDocument: (request.clinic as { document?: string | null }).document ?? null,
    })

    const now = new Date()

    // SEC6: Upload da assinatura para object storage — NUNCA persistir base64 em PostgreSQL
    const signatureBase64Data = data.signatureBase64.replace(/^data:image\/\w+;base64,/, '')
    const signatureStorageKey = await uploadBuffer(
      `anamnesis/${request.clinicId}/${request.id}/signature.png`,
      Buffer.from(signatureBase64Data, 'base64'),
      'image/png',
    ).catch((err) => {
      logger.error({ err, requestId: request.id }, 'Falha no upload da assinatura para R2 — abortando submit')
      throw err
    })

    const count = await this.repo.submitSignature(signToken, {
      clientAnswers: data.clientAnswers,
      signatureUrl: signatureStorageKey,
      signatureHash,
      consentText,
      consentGivenAt: now,
      signedAt: now,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    })

    if (count === 0) {
      // Race condition: outra requisição já processou o token
      throw new ConflictError('Esta anamnese já foi assinada ou não está mais disponível.')
    }

    logger.info({ clinicId: request.clinicId, requestId: request.id }, 'Anamnese assinada')

    // RN21: Registrar auditLog da submissão pública (best-effort — não bloqueia resposta)
    prisma.auditLog.create({
      data: {
        action: 'anamnesis.public-submit',
        entityId: request.id,
        clinicId: request.clinicId,
        userId: 'public',
        metadata: { ipAddress: meta.ipAddress, userAgent: meta.userAgent } as Prisma.InputJsonValue,
      },
    }).catch((err) => logger.error({ err, requestId: request.id }, 'Falha ao criar auditLog de submit'))

    // Publicar evento para criação automática do prontuário
    eventBus.publish(
      createDomainEvent('anamnesis.signed', request.clinicId, {
        anamnesisRequestId: request.id,
        clinicId: request.clinicId,
        customerId: request.customer.id,
        groupName: request.groupName,
        signedAt: now.toISOString(),
      }),
    )

    return { success: true }
  }

  async resend(clinicId: string, id: string, data: ResendAnamnesisDto) {
    const existing = await this.repo.findById(clinicId, id)
    if (!existing) throw new NotFoundError('AnamnesisRequest')

    if (!['pending', 'correction_requested', 'expired', 'sent_to_client'].includes(existing.status)) {
      throw new ConflictError('Não é possível reenviar uma anamnese cancelada ou já assinada.')
    }

    const newToken = generateSignToken()
    const expiresAt = buildExpiresAt()
    const updated = await this.repo.resend(clinicId, id, newToken, expiresAt)

    if (data.phone || data.email) {
      // SEC2: signToken passado da variável local newToken — não vem do objeto `updated`
      this.#sendNotification(clinicId, { ...updated, signToken: newToken }, { phone: data.phone, email: data.email }).catch((err) =>
        logger.error({ err, requestId: id }, 'Falha ao reenviar notificação de anamnese'),
      )
    }

    logger.info({ clinicId, requestId: id }, 'AnamnesisRequest reenviada')
    return updated
  }

  async cancel(clinicId: string, id: string) {
    return this.repo.cancel(clinicId, id)
  }

  /** Finaliza localmente: DRAFT → CLINIC_FILLED */
  async finalize(clinicId: string, id: string) {
    const existing = await this.repo.findById(clinicId, id)
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    if (existing.status !== 'draft' && existing.status !== 'pending') {
      throw new ValidationError('Apenas anamneses em rascunho podem ser finalizadas localmente.')
    }
    return this.repo.updateStatus(clinicId, id, 'clinic_filled')
  }

  /** Envia ao cliente: gera signToken + consentText server-side + notificação */
  async sendToClient(clinicId: string, id: string, channels: { phone?: string; email?: string }) {
    const existing = await this.repo.findByIdWithClinic(clinicId, id)
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    if (!['draft', 'pending', 'clinic_filled'].includes(existing.status)) {
      throw new ValidationError('Esta anamnese não pode ser enviada ao cliente no status atual.')
    }

    const signToken = generateSignToken()
    const expiresAt = buildExpiresAt()

    // consentText gerado server-side — RN17/SEC1
    const consentText = buildConsentText({
      customerName: existing.customer.name,
      groupName: existing.groupName,
      clinicName: existing.clinic.name,
      clinicDocument: (existing.clinic as { document?: string | null }).document ?? null,
    })

    const updated = await this.repo.setSignToken(clinicId, id, signToken, expiresAt, consentText)

    if (channels.phone || channels.email) {
      // SEC2: signToken passado da variável local — não vem do objeto `updated` (que não o expõe)
      this.#sendNotification(clinicId, { ...updated, signToken }, channels).catch((err) =>
        logger.error({ err, requestId: id }, 'Falha ao enviar notificação de anamnese'),
      )
    }

    logger.info({ clinicId, requestId: id }, 'AnamnesisRequest enviada ao cliente')
    return updated
  }

  /**
   * resolve-diff — resolve divergências campo-a-campo e transiciona para SIGNED.
   * Transação atômica: se auditLog falhar, o status SIGNED é revertido.
   */
  async resolveDiff(clinicId: string, id: string, dto: ResolveDiffDto, userId: string) {
    const result = await prisma.$transaction(async (tx) => {
      const anamnesis = await tx.anamnesisRequest.findFirst({
        where: { id, deletedAt: null },
        select: { id: true, status: true, clinicId: true },
      })
      if (!anamnesis) throw new NotFoundError('AnamnesisRequest')
      if (anamnesis.clinicId !== clinicId) throw new NotFoundError('AnamnesisRequest')

      // Idempotência: já assinada, retorna sem re-processar
      if (anamnesis.status === 'signed') {
        return tx.anamnesisRequest.findFirst({
          where: { id, clinicId, deletedAt: null },
          select: safeAnamnesisSelect,
        })
      }

      if (anamnesis.status !== 'client_submitted') {
        throw new ValidationError('Apenas anamneses com status "Aguardando revisão" podem ser resolvidas.')
      }

      const updated = await tx.anamnesisRequest.update({
        where: { id },
        data: {
          diffResolution: dto.resolutions,
          status: 'signed',
          signedAt: new Date(),
        },
        select: safeAnamnesisSelect,
      })

      await tx.auditLog.create({
        data: {
          action: 'anamnesis.resolve-diff',
          entityId: id,
          clinicId,
          userId,
          metadata: dto.resolutions as Prisma.InputJsonValue,
        },
      })

      return updated
    })

    logger.info({ clinicId, requestId: id }, 'Anamnese resolve-diff concluído')
    return result
  }

  async requestCorrection(signToken: string) {
    const request = await this.repo.findByToken(signToken)
    if (!request) throw new NotFoundError('AnamnesisRequest')

    // SEC3: expiração verificada universalmente
    if (request.expiresAt < new Date()) {
      throw new GoneError('Este link de anamnese expirou.')
    }

    const result = await this.repo.requestCorrection(signToken)
    if (result.count === 0) {
      throw new ConflictError('Esta anamnese não está disponível para solicitação de correção.')
    }

    return { success: true }
  }

  async #sendNotification(
    clinicId: string,
    request: {
      id: string
      customer: { id: string; phone: string | null; email: string | null }
      groupName: string
      signToken: string
      expiresAt: Date
    },
    channels: { phone?: string; email?: string },
  ) {
    const link = buildSignLink(request.signToken)
    const expiresFormatted = request.expiresAt.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })

    if (channels.phone) {
      await this.notifications.sendWhatsApp({
        clinicId,
        phone: channels.phone,
        message:
          `Olá! A clínica enviou uma ficha de anamnese para você preencher.\n\n` +
          `📋 *${request.groupName}*\n\n` +
          `Acesse o link abaixo para preencher e assinar:\n${link}\n\n` +
          `⚠️ Este link expira em ${expiresFormatted}.`,
        event: 'anamnesis.requested',
        customerId: request.customer.id,
      })
    }

    if (channels.email) {
      await this.notifications.sendEmail({
        clinicId,
        email: channels.email,
        subject: `Ficha de anamnese: ${request.groupName}`,
        htmlBody: `
          <p>Olá!</p>
          <p>A clínica enviou uma ficha de anamnese para você preencher.</p>
          <p><strong>${request.groupName}</strong></p>
          <p>
            <a href="${link}" style="
              display: inline-block;
              padding: 12px 24px;
              background: #6366f1;
              color: #fff;
              text-decoration: none;
              border-radius: 6px;
            ">Preencher Anamnese</a>
          </p>
          <p>Este link expira em ${expiresFormatted}.</p>
          <hr/>
          <p style="font-size: 12px; color: #888;">
            Se você não reconhece este envio, ignore este e-mail.
          </p>
        `,
        event: 'anamnesis.requested',
        customerId: request.customer.id,
      })
    }
  }
}

// Singleton lazy para evitar side effects em import time nos domain-event-handlers.
let _anamnesisServiceInstance: AnamnesisService | undefined

export function getAnamnesisService(): AnamnesisService {
  if (!_anamnesisServiceInstance) {
    _anamnesisServiceInstance = new AnamnesisService()
  }
  return _anamnesisServiceInstance
}

// Proxy mantém compatibilidade com imports existentes mas adia a instanciação até o primeiro uso.
export const anamnesisService = new Proxy({} as AnamnesisService, {
  get(_target, prop, receiver) {
    return Reflect.get(getAnamnesisService(), prop, receiver)
  },
})

/** Transforma snapshot de perguntas + respostas no formato { groupId, groupName, entries } esperado pelo prontuário. */
function buildClinicalRecordContent(request: {
  groupId: string
  groupName: string
  questionsSnapshot: unknown
  staffAnswers: unknown
  clientAnswers: unknown
}) {
  const snapshot = (request.questionsSnapshot as Array<{ id: string; text: string; type?: string }>) ?? []
  const clientAnswers = (request.clientAnswers as Record<string, unknown>) ?? {}
  const staffAnswers = (request.staffAnswers as Record<string, unknown>) ?? {}

  const entries = snapshot
    .filter((q) => q.type !== 'separator')
    .map((q) => {
      const answer = clientAnswers[q.id] ?? staffAnswers[q.id] ?? ''
      return { question: q.text, answer: String(answer), type: q.type }
    })

  return { groupId: request.groupId, groupName: request.groupName, entries }
}

/** Cria o prontuário clínico automaticamente após anamnese assinada. */
export async function handleAnamnesisSignedEvent(payload: {
  anamnesisRequestId: string
  clinicId: string
  customerId: string
  groupName: string
  signedAt: string
}) {
  await prisma.$transaction(async (tx) => {
    const request = await tx.anamnesisRequest.findFirst({
      where: { id: payload.anamnesisRequestId, clinicId: payload.clinicId },
    })
    if (!request) return

    // Verificar se já existe um ClinicalRecord linkado (idempotência)
    const existing = await tx.clinicalRecord.findFirst({
      where: { anamnesisRequestId: request.id },
    })
    if (existing) return

    await tx.clinicalRecord.create({
      data: {
        clinicId: payload.clinicId,
        customerId: payload.customerId,
        title: `Anamnese — ${payload.groupName}`,
        content: JSON.stringify(buildClinicalRecordContent(request)),
        type: 'anamnesis',
        performedAt: new Date(payload.signedAt),
        anamnesisRequestId: request.id,
      },
    })

    logger.info(
      { clinicId: payload.clinicId, anamnesisRequestId: request.id },
      'ClinicalRecord criado automaticamente após anamnese assinada',
    )
  })
}
