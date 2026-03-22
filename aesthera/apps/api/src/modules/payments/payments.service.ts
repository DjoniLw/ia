import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { createDomainEvent } from '../../shared/events/domain-event'
import { eventBus } from '../../shared/events/event-bus'
import { prisma } from '../../database/prisma/client'
import { appConfig } from '../../config/app.config'
import { createGateway, StripeGateway, MercadoPagoGateway } from './payment.gateway'
import { PaymentsRepository } from './payments.repository'
import { createAuditLog } from '../../shared/audit'
import type { ListPaymentsQuery } from './payments.dto'

export class PaymentsService {
  private repo = new PaymentsRepository()

  async list(clinicId: string, q: ListPaymentsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const p = await this.repo.findById(clinicId, id)
    if (!p) throw new NotFoundError('Payment')
    return p
  }

  /**
   * Called internally when a billing record is created.
   * Creates a payment intent via the configured gateway.
   */
  async createForBilling(billingId: string) {
    const billing = await prisma.billing.findUnique({
      where: { id: billingId },
      include: {
        customer: true,
        appointment: { include: { service: true } },
      },
    })
    if (!billing) throw new NotFoundError('Billing')

    // Idempotent: if payment already exists, return it
    const existing = await prisma.payment.findFirst({ where: { billingId } })
    if (existing) return existing

    const preferredMethod = billing.paymentMethods.find((method) =>
      ['pix', 'boleto', 'card'].includes(method),
    )
    const method = (preferredMethod ??
      (billing.paymentMethods.includes('duplicata') ? 'boleto' : 'pix')) as
      | 'pix'
      | 'boleto'
      | 'card'
    const gateway = createGateway(method)

    const intent = await gateway.createIntent({
      billingId: billing.id,
      customerId: billing.customerId,
      amount: billing.amount,
      method,
      dueDate: billing.dueDate,
      description: `Serviço: ${billing.appointment?.service?.name ?? ''}`,
      metadata: { clinicId: billing.clinicId },
    })

    const payment = await this.repo.create({
      clinicId: billing.clinicId,
      billingId: billing.id,
      customerId: billing.customerId,
      gateway: gateway.name === 'mock' ? 'mercadopago' : (gateway.name as 'stripe' | 'mercadopago'),
      method,
      amount: billing.amount,
      gatewayPaymentId: intent.gatewayPaymentId,
      paymentUrl: intent.paymentUrl,
      pixQrCode: intent.pixQrCode,
      expiresAt: intent.expiresAt,
    })

    // Update billing with payment link
    await prisma.billing.update({
      where: { id: billingId },
      data: { paymentLink: intent.paymentUrl },
    })

    return payment
  }

  /**
   * Handles mock payment confirmation (dev only).
   * In production, this is replaced by real webhook callbacks.
   */
  async confirmMockPayment(gatewayPaymentId: string) {
    const payment = await this.repo.findByGatewayId(gatewayPaymentId)
    if (!payment) throw new NotFoundError('Payment')

    if (payment.status !== 'pending') {
      throw new AppError('Payment already processed', 400, 'ALREADY_PROCESSED')
    }

    const updated = await this.repo.updateStatus(payment.id, 'paid', { paidAt: new Date() })

    // Update billing
    await prisma.billing.update({
      where: { id: payment.billingId },
      data: { status: 'paid', paidAt: new Date() },
    })

    // Emit event for ledger + notifications
    eventBus.publish(
      createDomainEvent('payment.succeeded', payment.clinicId, {
        paymentId: payment.id,
        billingId: payment.billingId,
        customerId: payment.customerId,
        amount: payment.amount,
      }),
    )

    await createAuditLog({
      clinicId: payment.clinicId,
      userId: 'system',
      action: 'payment.confirmed',
      entityId: payment.id,
      metadata: {
        billingId: payment.billingId,
        amount: payment.amount,
        gateway: payment.gateway,
      },
    })

    return updated
  }

  async handleStripeWebhook(rawBody: Buffer, signature: string): Promise<{ received: true }> {
    if (!appConfig.stripe.webhookSecret) {
      throw new AppError('Stripe webhook não configurado', 503, 'WEBHOOK_NOT_CONFIGURED')
    }
    const gateway = new StripeGateway()
    if (!gateway.verifyWebhookSignature(rawBody, signature)) {
      throw new AppError('Assinatura Stripe inválida', 400, 'INVALID_SIGNATURE')
    }
    return { received: true }
  }

  async handleMercadoPagoWebhook(
    rawBody: Buffer,
    signature: string,
    requestId: string,
  ): Promise<{ received: true }> {
    if (!appConfig.mercadopago.webhookSecret) {
      throw new AppError('MercadoPago webhook não configurado', 503, 'WEBHOOK_NOT_CONFIGURED')
    }
    const gateway = new MercadoPagoGateway()
    if (!gateway.verifyWebhookSignature(rawBody, signature, requestId)) {
      throw new AppError('Assinatura MercadoPago inválida', 400, 'INVALID_SIGNATURE')
    }
    return { received: true }
  }

  /**
   * Public payment page: get billing info by token.
   */
  async getBillingByToken(token: string) {
    const billing = await prisma.billing.findUnique({
      where: { paymentToken: token },
      include: {
        customer: { select: { name: true, email: true } },
        appointment: {
          include: {
            service: { select: { name: true, durationMinutes: true } },
            professional: { select: { name: true } },
            clinic: { select: { name: true } },
          },
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    })
    if (!billing) throw new NotFoundError('Billing')
    return billing
  }
}
