import { prisma } from '../../database/prisma/client'
import { NotFoundError, ValidationError } from '../../shared/errors/app-error'
import { generateId } from '../../shared/utils/id'
import crypto from 'crypto'
import {
  CreateInvoiceDto,
  ListInvoicesDto,
  CancelInvoiceDto,
} from './invoices.dto'
import { InvoiceStatus } from '@prisma/client'

export class InvoicesService {
  async create(companyId: string, customerId: string, data: CreateInvoiceDto) {
    // Validate customer exists
    await prisma.customer.findFirst({
      where: { id: customerId, companyId, deletedAt: null },
    })

    const invoiceId = generateId()
    const paymentToken = crypto.randomBytes(32).toString('hex')
    const idempotencyKey = `${companyId}-${customerId}-${Date.now()}`

    const invoice = await prisma.invoice.create({
      data: {
        id: invoiceId,
        companyId,
        customerId,
        amount: data.amount,
        description: data.description,
        dueDate: data.dueDate,
        status: 'draft' as InvoiceStatus,
        paymentMethods: data.paymentMethods,
        paymentToken,
        idempotencyKey,
        metadata: data.metadata ? JSON.parse(JSON.stringify(data.metadata)) : null,
        notify: data.notify,
      },
    })

    return invoice
  }

  async getById(companyId: string, invoiceId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, companyId },
      include: { customer: true, payments: true, ledgerEntries: true },
    })

    if (!invoice) throw new NotFoundError('Invoice')

    return invoice
  }

  async list(companyId: string, params: ListInvoicesDto) {
    const skip = (params.page - 1) * params.limit

    const where: any = {
      companyId,
      ...(params.status && { status: params.status }),
      ...(params.customerId && { customerId: params.customerId }),
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: params.limit,
        orderBy: { [params.sort]: params.order },
        include: { customer: true, payments: true },
      }),
      prisma.invoice.count({ where }),
    ])

    return {
      data: invoices,
      pagination: {
        page: params.page,
        limit: params.limit,
        total,
        totalPages: Math.ceil(total / params.limit),
      },
    }
  }

  async changeStatus(
    companyId: string,
    invoiceId: string,
    newStatus: InvoiceStatus,
  ) {
    const invoice = await this.getById(companyId, invoiceId)

    // State machine validation
    const validTransitions: Record<InvoiceStatus, InvoiceStatus[]> = {
      draft: ['pending', 'cancelled'],
      pending: ['paid', 'cancelled', 'expired'],
      paid: [],
      overdue: ['paid', 'cancelled'],
      cancelled: [],
      expired: [],
    }

    if (!validTransitions[invoice.status].includes(newStatus)) {
      throw new ValidationError(
        `Cannot transition from ${invoice.status} to ${newStatus}`,
      )
    }

    const data: any = { status: newStatus }

    if (newStatus === 'paid') {
      data.paidAt = new Date()
    } else if (newStatus === 'cancelled') {
      data.cancelledAt = new Date()
    } else if (newStatus === 'expired') {
      data.expiredAt = new Date()
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data,
    })
  }

  async sendToPayment(companyId: string, invoiceId: string) {
    const invoice = await this.getById(companyId, invoiceId)

    if (invoice.status !== 'draft') {
      throw new ValidationError('Only draft invoices can be sent to payment')
    }

    const paymentLink = `https://checkout.fluxa.test/pay/${invoice.paymentToken}`

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'pending' as InvoiceStatus,
        paymentLink,
      },
    })
  }

  async cancel(companyId: string, invoiceId: string, data?: CancelInvoiceDto) {
    const invoice = await this.getById(companyId, invoiceId)

    if (['paid', 'cancelled'].includes(invoice.status)) {
      throw new ValidationError(`Cannot cancel a ${invoice.status} invoice`)
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'cancelled' as InvoiceStatus,
        cancelledAt: new Date(),
        metadata: {
          ...(invoice.metadata as any),
          cancelReason: data?.reason,
        },
      },
    })
  }

  async markAsPaid(companyId: string, invoiceId: string, paymentId: string) {
    const invoice = await this.getById(companyId, invoiceId)
    const payment = await prisma.payment.findFirst({
      where: { id: paymentId, companyId },
    })

    if (!payment) throw new NotFoundError('Payment')

    if (invoice.status !== 'pending' && invoice.status !== 'overdue') {
      throw new ValidationError('Only pending or overdue invoices can be marked as paid')
    }

    // Create ledger entry
    await prisma.ledgerEntry.create({
      data: {
        id: generateId(),
        companyId,
        type: 'credit',
        amount: invoice.amount,
        currency: 'BRL',
        referenceId: paymentId,
        invoiceId,
        customerId: invoice.customerId,
        description: `Payment for invoice ${invoiceId}`,
      },
    })

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: 'paid' as InvoiceStatus,
        paidAt: new Date(),
      },
    })
  }

  async checkOverdue() {
    const now = new Date()

    // Mark overdue invoices
    await prisma.invoice.updateMany({
      where: {
        status: 'pending' as InvoiceStatus,
        dueDate: { lt: now },
      },
      data: {
        status: 'overdue' as InvoiceStatus,
      },
    })
  }
}

export const invoicesService = new InvoicesService()
