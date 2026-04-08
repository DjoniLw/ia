import crypto from 'node:crypto'
import { appConfig } from '../../config/app.config'
import { prisma } from '../../database/prisma/client'
import { ConflictError, GoneError, NotFoundError } from '../../shared/errors/app-error'
import { createDomainEvent } from '../../shared/events/domain-event'
import { eventBus } from '../../shared/events/event-bus'
import { logger } from '../../shared/logger/logger'
import { NotificationsService } from '../notifications/notifications.service'
import type { CreateAnamnesisRequestDto, ListAnamnesisRequestsQuery, ResendAnamnesisDto } from './anamnesis.dto'
import { AnamnesisRepository } from './anamnesis.repository'

const TTL_HOURS = 72

function generateSignToken() {
  return crypto.randomBytes(32).toString('hex')
}

function buildExpiresAt() {
  const d = new Date()
  d.setHours(d.getHours() + TTL_HOURS)
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

    const request = await this.repo.create(clinicId, userId, {
      ...data,
      signToken,
      expiresAt,
    })

    // Envio assíncrono — não bloqueia a resposta
    if (data.phone || data.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.#sendNotification(clinicId, request as any, { phone: data.phone, email: data.email }).catch((err) =>
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

    // Lazy expiry check (CA09)
    if (request.expiresAt < new Date() && request.status === 'pending') {
      await this.repo.markExpired(request.clinicId, request.id)
      throw new GoneError('Este link de anamnese expirou. Solicite um novo envio à clínica.')
    }

    if (request.status === 'expired') {
      throw new GoneError('Este link de anamnese expirou. Solicite um novo envio à clínica.')
    }

    if (request.status === 'signed') {
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
      clientAnswers: Record<string, unknown>
      signature: string
      consentGiven: true
      /** Snapshot do texto de consentimento exibido ao paciente (CA06/CA18) */
      consentText?: string
    },
    meta: { ipAddress: string | null; userAgent: string | null },
  ) {
    // Buscar dados completos ANTES de submeter para compor o evento
    const request = await this.repo.findByToken(signToken)
    if (!request) throw new NotFoundError('AnamnesisRequest')

    // Lazy expiry check
    if (request.expiresAt < new Date() && request.status === 'pending') {
      await this.repo.markExpired(request.clinicId, request.id)
      throw new GoneError('Este link de anamnese expirou. Solicite um novo envio à clínica.')
    }

    if (request.status !== 'pending' && request.status !== 'correction_requested') {
      throw new ConflictError('Esta anamnese não está disponível para assinatura.')
    }

    const signatureHash = crypto
      .createHash('sha256')
      .update(data.signature)
      .digest('hex')

    // CA06/CA18: persistir exatamente o texto exibido ao paciente, com fallback para geração automática
    const consentText = data.consentText ?? buildConsentText({
      customerName: request.customer.name,
      groupName: request.groupName,
      clinicName: request.clinic.name,
      clinicDocument: (request.clinic as { document?: string | null }).document ?? null,
    })

    const now = new Date()
    const count = await this.repo.submitSignature(signToken, {
      clientAnswers: data.clientAnswers,
      signature: data.signature,
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

    if (!['pending', 'correction_requested', 'expired'].includes(existing.status)) {
      throw new ConflictError('Não é possível reenviar uma anamnese cancelada ou já assinada.')
    }

    const newToken = generateSignToken()
    const expiresAt = buildExpiresAt()
    const updated = await this.repo.resend(clinicId, id, newToken, expiresAt)

    if (data.phone || data.email) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      this.#sendNotification(clinicId, updated as any, { phone: data.phone, email: data.email }).catch((err) =>
        logger.error({ err, requestId: id }, 'Falha ao reenviar notificação de anamnese'),
      )
    }

    logger.info({ clinicId, requestId: id }, 'AnamnesisRequest reenviada')
    return updated
  }

  async cancel(clinicId: string, id: string) {
    return this.repo.cancel(clinicId, id)
  }

  async requestCorrection(signToken: string) {
    const request = await this.repo.findByToken(signToken)
    if (!request) throw new NotFoundError('AnamnesisRequest')

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

/** Transforma snapshot de perguntas + respostas no formato { groupName, entries } esperado pelo prontuário. */
function buildClinicalRecordContent(request: {
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

  return { groupName: request.groupName, entries }
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
