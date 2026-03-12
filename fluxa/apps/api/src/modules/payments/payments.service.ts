import { prisma } from '../../database/prisma/client'
import { NotFoundError, ValidationError } from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import { eventBus } from '../../shared/events/event-bus'
import { createDomainEvent } from '../../shared/events/domain-event'
import { PaymentGateway, PaymentMethod, PaymentStatus } from '@prisma/client'
import crypto from 'crypto'
import { CreatePaymentIntentDto, ListPaymentsDto } from './payments.dto'

export class PaymentsService {
  async createPaymentIntent(
    companyId: string,
    invoiceId: string,
    data: CreatePaymentIntentDto,
  ) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
    })

    if (!invoice) throw new NotFoundError('Invoice')

    // Determine gateway based on method
    const gateway: PaymentGateway = data.method === 'card' ? 'stripe' : 'mercadopago'

    const paymentId = generateId()

    // Simulate gateway payment creation
    const { paymentUrl, pixQrCode, gatewayPaymentId } = await this.createGatewayPayment(
      companyId,
      invoice,
      gateway,
      data.method,
    )

    const payment = await prisma.payment.create({
      data: {
        id: paymentId,
        companyId,
        invoiceId,
        customerId: invoice.customerId,
        gateway,
        method: data.method as PaymentMethod,
        status: 'pending' as PaymentStatus,
        amount: invoice.amount,
        gatewayPaymentId,
        paymentUrl,
        pixQrCode,
        expiresAt: this.calculateExpiration(data.method, invoice.dueDate),
      },
    })

    // Update invoice with payment links
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        paymentLink: paymentUrl,
        paymentMethods: [data.method],
      },
    })

    return payment
  }

  async getById(companyId: string, paymentId: string) {
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, companyId },
      include: { invoice: true },
    })

    if (!payment) throw new NotFoundError('Payment')

    return payment
  }

  async list(companyId: string, params: ListPaymentsDto) {
    const skip = (params.page - 1) * params.limit

    const where: any = {
      companyId,
      ...(params.status && { status: params.status }),
      ...(params.invoiceId && { invoiceId: params.invoiceId }),
      ...(params.gateway && { gateway: params.gateway }),
    }

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
        include: { invoice: true },
      }),
      prisma.payment.count({ where }),
    ])

    return {
      data: payments,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    }
  }

  async handleStripeWebhook(signature: string, rawBody: string, body: any) {
    // Verify signature (simplified — in production use Stripe SDK)
    const secret = process.env.STRIPE_WEBHOOK_SECRET || ''
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (hash !== signature) {
      throw new ValidationError('Invalid Stripe signature')
    }

    const { id: eventId, type, data } = body

    // Check idempotency
    const existing = await prisma.payment.findFirst({
      where: { gatewayEventId: eventId },
    })

    if (existing) {
      return { processed: false, message: 'Event already processed' }
    }

    const paymentIntentId = data.object.id
    const status = data.object.status

    const payment = await prisma.payment.findFirst({
      where: { gatewayPaymentId: paymentIntentId },
    })

    if (!payment) {
      throw new NotFoundError('Payment')
    }

    let newStatus: PaymentStatus = payment.status
    const updates: any = { gatewayEventId: eventId }

    if (type === 'payment_intent.succeeded' && status === 'succeeded') {
      newStatus = 'paid'
      updates.paidAt = new Date()
    } else if (type === 'payment_intent.payment_failed') {
      newStatus = 'failed'
    } else if (type === 'charge.dispute.created') {
      newStatus = 'disputed'
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus, ...updates },
    })

    // Emit domain event
    eventBus.publish(
      createDomainEvent(
        newStatus === 'paid' ? 'payment.succeeded' : `payment.${newStatus}`,
        payment.companyId,
        {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          status: newStatus,
          amount: payment.amount,
        },
      ),
    )

    return { processed: true, payment: updated }
  }

  async handleMercadoPagoWebhook(signature: string, rawBody: string, body: any) {
    // Verify signature (simplified)
    const secret = process.env.MP_WEBHOOK_SECRET || ''
    const hash = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex')

    if (hash !== signature) {
      throw new ValidationError('Invalid MercadoPago signature')
    }

    const { id: eventId, type, data } = body

    // Check idempotency
    const existing = await prisma.payment.findFirst({
      where: { gatewayEventId: eventId },
    })

    if (existing) {
      return { processed: false, message: 'Event already processed' }
    }

    const paymentId = String(data.id)

    const payment = await prisma.payment.findFirst({
      where: { gatewayPaymentId: paymentId },
    })

    if (!payment) {
      throw new NotFoundError('Payment')
    }

    let newStatus: PaymentStatus = payment.status
    const updates: any = { gatewayEventId: eventId }

    if (type === 'payment.updated') {
      if (data.status === 'approved') {
        newStatus = 'paid'
        updates.paidAt = new Date()
      } else if (data.status === 'rejected') {
        newStatus = 'failed'
      } else if (data.status === 'refunded') {
        newStatus = 'refunded'
      }
    }

    const updated = await prisma.payment.update({
      where: { id: payment.id },
      data: { status: newStatus, ...updates },
    })

    // Emit domain event
    eventBus.publish(
      createDomainEvent(
        newStatus === 'paid' ? 'payment.succeeded' : `payment.${newStatus}`,
        payment.companyId,
        {
          paymentId: payment.id,
          invoiceId: payment.invoiceId,
          status: newStatus,
          amount: payment.amount,
        },
      ),
    )

    return { processed: true, payment: updated }
  }

  private async createGatewayPayment(
    _companyId: string,
    _invoice: any,
    gateway: PaymentGateway,
    method: PaymentMethod,
  ) {
    // Simulate gateway API calls (in production use real SDKs)
    const gatewayPaymentId = `${gateway}_${generateId().slice(0, 8)}`

    let paymentUrl = ''
    let pixQrCode = ''

    if (gateway === 'stripe' && method === 'card') {
      paymentUrl = `https://checkout.stripe.com/pay/${gatewayPaymentId}`
    } else if (gateway === 'mercadopago') {
      if (method === 'pix') {
        // Simulate PIX QR code
        pixQrCode = `00020126580014br.gov.bcb.pix0136${generateId().slice(0, 20)}`
        paymentUrl = `https://qr.mercadopago.com/${gatewayPaymentId}`
      } else if (method === 'boleto') {
        // Simulate boleto
        paymentUrl = `https://boleto.mercadopago.com/${gatewayPaymentId}`
      }
    }

    return { gatewayPaymentId, paymentUrl, pixQrCode }
  }

  private calculateExpiration(method: PaymentMethod, invoiceDueDate: Date): Date {
    const now = new Date()

    if (method === 'pix') {
      // PIX expires in 30 minutes
      return new Date(now.getTime() + 30 * 60 * 1000)
    } else if (method === 'boleto') {
      // Boleto expires on invoice due date
      return invoiceDueDate
    } else {
      // Card (Stripe) — no expiration, but mark after some days
      return new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
    }
  }
}

export const paymentsService = new PaymentsService()
