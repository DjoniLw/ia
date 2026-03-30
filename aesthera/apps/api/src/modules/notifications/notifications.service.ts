import { appConfig } from '../../config/app.config'
import { logger } from '../../shared/logger/logger'
import { NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type { ListNotificationsQuery } from './notifications.dto'
import { NotificationsRepository } from './notifications.repository'

interface SendWhatsAppInput {
  clinicId: string
  phone: string
  message: string
  event: string
  customerId?: string
  appointmentId?: string
  billingId?: string
}

interface SendEmailInput {
  clinicId: string
  email: string
  subject: string
  htmlBody: string
  event: string
  customerId?: string
  appointmentId?: string
  billingId?: string
}

export class NotificationsService {
  private repo = new NotificationsRepository()

  async list(clinicId: string, q: ListNotificationsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const log = await this.repo.findById(clinicId, id)
    if (!log) throw new NotFoundError('NotificationLog')
    return log
  }

  async sendWhatsApp(input: SendWhatsAppInput): Promise<void> {
    const log = await this.repo.create({
      clinicId: input.clinicId,
      type: 'whatsapp',
      channel: input.phone,
      event: input.event,
      payload: { phone: input.phone, message: input.message },
      customerId: input.customerId,
      appointmentId: input.appointmentId,
      billingId: input.billingId,
    })

    const { evolutionUrl, evolutionApiKey, evolutionInstance: globalInstance } = appConfig.whatsapp

    // Instância da clínica tem prioridade sobre a global
    const clinic = await prisma.clinic.findUnique({
      where: { id: input.clinicId },
      select: { whatsappInstance: true },
    })
    const evolutionInstance = clinic?.whatsappInstance ?? globalInstance

    if (!evolutionUrl || !evolutionApiKey || !evolutionInstance) {
      logger.warn({ event: input.event }, 'WhatsApp not configured, skipping send')
      await this.repo.markFailed(log.id, 'WHATSAPP_NOT_CONFIGURED', 1)
      return
    }

    try {
      const url = `${evolutionUrl}/message/sendText/${evolutionInstance}`
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': evolutionApiKey,
        },
        body: JSON.stringify({ number: input.phone, text: input.message }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Evolution API ${res.status}: ${txt}`)
      }
      await this.repo.markSent(log.id)
      logger.info({ event: input.event, phone: input.phone }, 'WhatsApp sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.repo.markFailed(log.id, msg, 1)
      logger.error({ err, event: input.event }, 'WhatsApp send failed')
    }
  }

  async sendEmail(input: SendEmailInput): Promise<void> {
    const log = await this.repo.create({
      clinicId: input.clinicId,
      type: 'email',
      channel: input.email,
      event: input.event,
      payload: { to: input.email, subject: input.subject, html: input.htmlBody },
      customerId: input.customerId,
      appointmentId: input.appointmentId,
      billingId: input.billingId,
    })

    const { apiKey, from } = appConfig.email

    // Verifica se a clínica tem SMTP próprio configurado
    const clinic = await prisma.clinic.findUnique({
      where: { id: input.clinicId },
      select: { smtpHost: true, smtpPort: true, smtpUser: true, smtpPass: true, smtpFrom: true, smtpSecure: true },
    })

    const hasClinicSmtp = !!(clinic?.smtpHost && clinic?.smtpUser && clinic?.smtpPass)

    if (hasClinicSmtp) {
      // Envio via SMTP da clínica (Gmail, Outlook, etc.)
      try {
        const nodemailer = await import('nodemailer')
        const transporter = nodemailer.createTransport({
          host: clinic!.smtpHost!,
          port: clinic!.smtpPort ?? (clinic!.smtpSecure ? 465 : 587),
          secure: clinic!.smtpSecure,
          auth: { user: clinic!.smtpUser!, pass: clinic!.smtpPass! },
        })
        await transporter.sendMail({
          from: clinic!.smtpFrom ?? clinic!.smtpUser!,
          to: input.email,
          subject: input.subject,
          html: input.htmlBody,
        })
        await this.repo.markSent(log.id)
        logger.info({ event: input.event, email: input.email }, 'Email sent via clinic SMTP')
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        await this.repo.markFailed(log.id, msg, 1)
        logger.error({ err, event: input.event }, 'Clinic SMTP send failed')
      }
      return
    }

    if (!apiKey) {
      logger.warn({ event: input.event }, 'Email not configured, skipping send')
      await this.repo.markFailed(log.id, 'EMAIL_NOT_CONFIGURED', 1)
      return
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          from: from ?? 'noreply@aesthera.app',
          to: [input.email],
          subject: input.subject,
          html: input.htmlBody,
        }),
      })
      if (!res.ok) {
        const txt = await res.text()
        throw new Error(`Resend ${res.status}: ${txt}`)
      }
      await this.repo.markSent(log.id)
      logger.info({ event: input.event, email: input.email }, 'Email sent')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      await this.repo.markFailed(log.id, msg, 1)
      logger.error({ err, event: input.event }, 'Email send failed')
    }
  }

  async retry(clinicId: string, id: string): Promise<{ queued: boolean }> {
    const log = await this.get(clinicId, id)
    if (log.status !== 'failed') {
      return { queued: false }
    }
    await this.repo.resetForRetry(id)

    // Re-send based on type
    const payload = log.payload as Record<string, string>
    if (log.type === 'whatsapp') {
      void this.sendWhatsApp({
        clinicId,
        phone: payload.phone ?? log.channel,
        message: payload.message ?? '',
        event: log.event,
        customerId: log.customerId ?? undefined,
        appointmentId: log.appointmentId ?? undefined,
        billingId: log.billingId ?? undefined,
      })
    } else {
      void this.sendEmail({
        clinicId,
        email: payload.to ?? log.channel,
        subject: payload.subject ?? 'Aesthera',
        htmlBody: payload.html ?? '',
        event: log.event,
        customerId: log.customerId ?? undefined,
        appointmentId: log.appointmentId ?? undefined,
        billingId: log.billingId ?? undefined,
      })
    }
    return { queued: true }
  }
}
