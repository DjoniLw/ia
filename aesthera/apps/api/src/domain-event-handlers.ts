/**
 * Domain event wiring: subscribes to business domain events and dispatches
 * cross-module side effects (payments, ledger, notifications).
 *
 * Called once at app startup from app.ts.
 */
import { eventBus } from './shared/events/event-bus'
import type { DomainEvent } from './shared/events/domain-event'
import { logger } from './shared/logger/logger'
import { PaymentsService } from './modules/payments/payments.service'
import { LedgerService } from './modules/ledger/ledger.service'
import { NotificationsService } from './modules/notifications/notifications.service'
import { prisma } from './database/prisma/client'

const paymentsService = new PaymentsService()
const ledgerService = new LedgerService()
const notificationsService = new NotificationsService()

// ── appointment.completed → create billing (handled in appointments.service) ──
// ── billing.created → create payment intent ────────────────────────────────────
eventBus.subscribe('billing.created', async (event: DomainEvent) => {
  const billingId = event.payload.billingId as string
  if (!billingId) return
  try {
    await paymentsService.createForBilling(billingId)
    logger.info({ billingId }, 'Payment intent created for billing')
  } catch (err) {
    logger.error({ err, billingId }, 'Failed to create payment intent for billing')
  }
})

// ── payment.succeeded → ledger credit + send receipt notification ──────────────
eventBus.subscribe('payment.succeeded', async (event: DomainEvent) => {
  const { paymentId, clinicId, amount, billingId, appointmentId, customerId } = event.payload as {
    paymentId: string
    clinicId: string
    amount: number
    billingId?: string
    appointmentId?: string
    customerId?: string
  }

  // 1. Create ledger credit entry
  try {
    await ledgerService.createCreditEntry({
      clinicId,
      paymentId,
      amount,
      billingId,
      appointmentId,
      customerId,
      description: 'Pagamento recebido',
    })
    logger.info({ paymentId }, 'Ledger credit entry created')
  } catch (err) {
    logger.error({ err, paymentId }, 'Failed to create ledger entry')
  }

  // 2. Send receipt notification if customer has contact info
  if (customerId) {
    try {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId },
        select: { name: true, email: true, phone: true },
      })

      if (customer) {
        const amountBrl = `R$ ${(amount / 100).toFixed(2)}`
        const message = `Olá, ${customer.name}! Recebemos o seu pagamento de ${amountBrl}. Obrigado pela confiança! 💙`

        if (customer.phone) {
          void notificationsService.sendWhatsApp({
            clinicId,
            phone: customer.phone,
            message,
            event: 'payment.succeeded',
            customerId,
            billingId,
          })
        }

        if (customer.email) {
          void notificationsService.sendEmail({
            clinicId,
            email: customer.email,
            subject: `Pagamento de ${amountBrl} confirmado`,
            htmlBody: `<p>${message}</p>`,
            event: 'payment.succeeded',
            customerId,
            billingId,
          })
        }
      }
    } catch (err) {
      logger.error({ err, customerId }, 'Failed to send payment receipt notification')
    }
  }
})

// ── appointment.confirmed → send confirmation notification ────────────────────
eventBus.subscribe('appointment.confirmed', async (event: DomainEvent) => {
  const { clinicId, appointmentId, customerId } = event.payload as {
    clinicId: string
    appointmentId: string
    customerId: string
  }

  try {
    const appointment = await prisma.appointment.findFirst({
      where: { id: appointmentId },
      include: {
        customer: { select: { name: true, email: true, phone: true } },
        service: { select: { name: true } },
        professional: { select: { name: true } },
      },
    })

    if (!appointment) return

    const date = appointment.scheduledAt.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    const time = appointment.scheduledAt.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    })

    const message = `Olá, ${appointment.customer.name}! Seu agendamento de ${appointment.service.name} com ${appointment.professional.name} foi confirmado para ${date} às ${time}. Até lá! 💙`

    if (appointment.customer.phone) {
      void notificationsService.sendWhatsApp({
        clinicId,
        phone: appointment.customer.phone,
        message,
        event: 'appointment.confirmed',
        customerId,
        appointmentId,
      })
    }
  } catch (err) {
    logger.error({ err, appointmentId }, 'Failed to send appointment confirmation notification')
  }
})

logger.info('Domain event handlers registered')
