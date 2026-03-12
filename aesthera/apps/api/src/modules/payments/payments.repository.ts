import { Prisma } from '@prisma/client'
import { prisma } from '../../database/prisma/client'
import type { ListPaymentsQuery } from './payments.dto'

export class PaymentsRepository {
  async findAll(clinicId: string, q: ListPaymentsQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.billingId) where.billingId = q.billingId
    if (q.status) where.status = q.status
    if (q.gateway) where.gateway = q.gateway

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true } },
          billing: { select: { id: true, amount: true, status: true, dueDate: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.payment.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.payment.findFirst({
      where: { id, clinicId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
        billing: {
          select: {
            id: true,
            amount: true,
            status: true,
            dueDate: true,
            appointment: {
              select: {
                id: true,
                scheduledAt: true,
                service: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    })
  }

  async findByGatewayId(gatewayPaymentId: string) {
    return prisma.payment.findUnique({ where: { gatewayPaymentId } })
  }

  async findByGatewayEventId(gatewayEventId: string) {
    return prisma.payment.findFirst({ where: { gatewayEventId } })
  }

  async create(data: {
    clinicId: string
    billingId: string
    customerId: string
    gateway: 'stripe' | 'mercadopago'
    method: 'pix' | 'boleto' | 'card'
    amount: number
    gatewayPaymentId: string
    paymentUrl?: string
    pixQrCode?: string
    expiresAt?: Date
    metadata?: Prisma.InputJsonValue
  }) {
    return prisma.payment.create({ data })
  }

  async updateStatus(
    id: string,
    status: string,
    extra?: Partial<{ paidAt: Date; gatewayEventId: string; metadata: Prisma.InputJsonValue }>,
  ) {
    return prisma.payment.update({
      where: { id },
      data: { status: status as Prisma.EnumPaymentStatusFilter<'Payment'>, ...extra, updatedAt: new Date() } as Prisma.PaymentUpdateInput,
    })
  }
}
