import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { createDomainEvent } from '../../shared/events/domain-event'
import { eventBus } from '../../shared/events/event-bus'
import { prisma } from '../../database/prisma/client'
import { createGateway } from './payment.gateway'
import { PaymentsRepository } from './payments.repository'
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

    const method = billing.paymentMethods[0] as 'pix' | 'boleto' | 'card' ?? 'pix'
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
      gateway: gateway.name === 'mock' ? 'mercadopago' : gateway.name as 'stripe' | 'mercadopago',
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

    return updated
  }

  async handleStripeWebhook(_payload: string, _signature: string) {
    return { received: true }
  }

  async handleMercadoPagoWebhook(_payload: string, _signature: string) {
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
