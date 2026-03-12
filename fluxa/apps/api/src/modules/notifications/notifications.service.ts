import { prisma } from '../../database/prisma/client'
import { NotFoundError, ValidationError } from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import { eventBus } from '../../shared/events/event-bus'
import { NotificationType, NotificationStatus } from '@prisma/client'
import crypto from 'crypto'
import { ListNotificationLogsDto } from './notifications.dto'

export class NotificationsService {
  constructor() {
    // Subscribe to domain events
    this.setupEventListeners()
  }

  private setupEventListeners() {
    // Listen to payment events
    eventBus.subscribe('payment.succeeded', (event) => {
      this.handlePaymentSucceeded(event)
    })

    eventBus.subscribe('payment.failed', (event) => {
      this.handlePaymentFailed(event)
    })

    // Listen to invoice events
    eventBus.subscribe('invoice.created', (event) => {
      this.handleInvoiceCreated(event)
    })

    eventBus.subscribe('invoice.overdue', (event) => {
      this.handleInvoiceOverdue(event)
    })

    eventBus.subscribe('invoice.cancelled', (event) => {
      this.handleInvoiceCancelled(event)
    })
  }

  async logLists(companyId: string, params: ListNotificationLogsDto) {
    const skip = (params.page - 1) * params.limit

    const where: any = {
      companyId,
      ...(params.status && { status: params.status }),
      ...(params.type && { type: params.type }),
      ...(params.invoiceId && { invoiceId: params.invoiceId }),
    }

    const [logs, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.notificationLog.count({ where }),
    ])

    return {
      data: logs,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    }
  }

  async getLog(companyId: string, logId: string) {
    const log = await prisma.notificationLog.findFirst({
      where: { id: logId, companyId },
    })

    if (!log) throw new NotFoundError('Notification log')

    return log
  }

  async retryNotification(companyId: string, logId: string) {
    const log = await this.getLog(companyId, logId)

    if (log.status === 'sent') {
      throw new ValidationError('Cannot retry a sent notification')
    }

    // Simulate retry
    const success = Math.random() > 0.3 // 70% success rate for demo

    const updated = await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status: success ? ('sent' as NotificationStatus) : ('failed' as NotificationStatus),
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        error: success ? null : 'Simulated retry failure',
      },
    })

    return updated
  }

  // Event handlers
  private async handlePaymentSucceeded(event: any) {
    const { companyId, payload } = event
    const { invoiceId, amount } = payload

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    })

    if (!invoice) return

    // Send customer email
    await this.queueEmailNotification(
      companyId,
      invoice.customerId,
      invoice.customer.email!,
      'payment-receipt',
      'invoice.paid',
      invoiceId,
      { invoiceId, amount },
    )

    // Send webhook to company
    await this.queueWebhookNotification(
      companyId,
      'invoice.paid',
      invoiceId,
      { invoiceId, amount, paidAt: new Date() },
    )
  }

  private async handlePaymentFailed(event: any) {
    const { companyId, payload } = event
    const { invoiceId } = payload

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    })

    if (!invoice) return

    // Send customer email
    await this.queueEmailNotification(
      companyId,
      invoice.customerId,
      invoice.customer.email!,
      'payment-failed',
      'payment.failed',
      invoiceId,
      payload,
    )

    // Send webhook
    await this.queueWebhookNotification(companyId, 'payment.failed', invoiceId, payload)
  }

  private async handleInvoiceCreated(event: any) {
    const { companyId, payload } = event
    const { invoiceId } = payload

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    })

    if (!invoice || !invoice.notify) return

    // Send customer email
    await this.queueEmailNotification(
      companyId,
      invoice.customerId,
      invoice.customer.email!,
      'invoice-created',
      'invoice.created',
      invoiceId,
      { invoiceId, amount: invoice.amount, dueDate: invoice.dueDate },
    )
  }

  private async handleInvoiceOverdue(event: any) {
    const { companyId, payload } = event
    const { invoiceId } = payload

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    })

    if (!invoice) return

    // Send customer email
    await this.queueEmailNotification(
      companyId,
      invoice.customerId,
      invoice.customer.email!,
      'invoice-overdue',
      'invoice.overdue',
      invoiceId,
      { invoiceId, dueDate: invoice.dueDate },
    )

    // Send webhook
    await this.queueWebhookNotification(companyId, 'invoice.overdue', invoiceId, payload)
  }

  private async handleInvoiceCancelled(event: any) {
    const { companyId, payload } = event
    const { invoiceId } = payload

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { customer: true },
    })

    if (!invoice) return

    // Send customer email
    await this.queueEmailNotification(
      companyId,
      invoice.customerId,
      invoice.customer.email!,
      'invoice-cancelled',
      'invoice.cancelled',
      invoiceId,
      { invoiceId },
    )
  }

  private async queueEmailNotification(
    companyId: string,
    customerId: string,
    email: string,
    template: string,
    eventName: string,
    invoiceId: string,
    payload: any,
  ) {
    // Create notification log (in real app, this would trigger a BullMQ job)
    const log = await prisma.notificationLog.create({
      data: {
        id: generateId(),
        companyId,
        type: 'email' as NotificationType,
        channel: email,
        event: eventName,
        customerId,
        invoiceId,
        status: 'pending' as NotificationStatus,
        attempts: 0,
        payload: { template, ...payload },
      },
    })

    // Simulate sending email (in production, enqueue to BullMQ)
    setTimeout(() => this.simulateSendEmail(log.id), 1000)

    return log
  }

  private async queueWebhookNotification(
    companyId: string,
    eventName: string,
    invoiceId: string,
    payload: any,
  ) {
    // Get all active webhook endpoints for this company
    const endpoints = await prisma.webhookEndpoint.findMany({
      where: {
        companyId,
        active: true,
        events: {
          has: eventName,
        },
      },
    })

    for (const endpoint of endpoints) {
      // Create notification log for each endpoint
      const log = await prisma.notificationLog.create({
        data: {
          id: generateId(),
          companyId,
          type: 'webhook' as NotificationType,
          channel: endpoint.url,
          event: eventName,
          invoiceId,
          webhookEndpointId: endpoint.id,
          status: 'pending' as NotificationStatus,
          attempts: 0,
          payload,
        },
      })

      // Simulate webhook delivery (in production, enqueue to BullMQ)
      setTimeout(() => this.simulateSendWebhook(log.id, endpoint.secret), 2000)
    }
  }

  private async simulateSendEmail(logId: string) {
    const log = await prisma.notificationLog.findUnique({
      where: { id: logId },
    })

    if (!log) return

    // Simulate success/failure
    const success = Math.random() > 0.1 // 90% success rate

    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status: success ? ('sent' as NotificationStatus) : ('failed' as NotificationStatus),
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        error: success ? null : 'Failed to deliver email',
      },
    })
  }

  private async simulateSendWebhook(logId: string, endpointSecret: string) {
    const log = await prisma.notificationLog.findUnique({
      where: { id: logId },
      include: { webhookEndpoint: true },
    })

    if (!log) return

    // Simulate webhook delivery with signature verification
    const signature = this.generateSignature(log.payload || {}, endpointSecret)

    // Simulate success/failure
    const success = Math.random() > 0.15 // 85% success rate

    await prisma.notificationLog.update({
      where: { id: logId },
      data: {
        status: success ? ('sent' as NotificationStatus) : ('failed' as NotificationStatus),
        attempts: { increment: 1 },
        lastAttemptAt: new Date(),
        error: success ? null : 'Webhook delivery failed',
        payload: {
          ...(log.payload as any),
          signature,
        },
      },
    })
  }

  private generateSignature(payload: any, secret: string): string {
    const body = JSON.stringify(payload)
    return crypto.createHmac('sha256', secret).update(body).digest('hex')
  }
}

export const notificationsService = new NotificationsService()
