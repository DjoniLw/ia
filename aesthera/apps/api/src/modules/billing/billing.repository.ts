import { prisma } from '../../database/prisma/client'
import type { ListBillingQuery } from './billing.dto'

const billingInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      durationMinutes: true,
      service: { select: { id: true, name: true } },
      professional: { select: { id: true, name: true } },
    },
  },
  service: { select: { id: true, name: true } },
  manualReceipt: {
    select: {
      id: true,
      totalPaid: true,
      receivedAt: true,
      notes: true,
      lines: {
        select: {
          id: true,
          paymentMethod: true,
          amount: true,
          walletEntryId: true,
          walletEntry: { select: { id: true, code: true, originType: true } },
        },
      },
    },
  },
} as const

export class BillingRepository {
  async findAll(clinicId: string, q: ListBillingQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.customerId) where.customerId = q.customerId
    if (q.appointmentId) where.appointmentId = q.appointmentId
    if (q.status) where.status = q.status
    if (q.sourceType) where.sourceType = q.sourceType
    if (q.customerName) {
      where.customer = { name: { contains: q.customerName, mode: 'insensitive' } }
    }

    if (q.dueDateFrom || q.dueDateTo) {
      const range: Record<string, Date> = {}
      if (q.dueDateFrom) range.gte = new Date(q.dueDateFrom)
      if (q.dueDateTo) range.lte = new Date(q.dueDateTo)
      where.dueDate = range
    }

    if (q.createdAtFrom || q.createdAtTo) {
      const range: Record<string, Date> = {}
      if (q.createdAtFrom) range.gte = new Date(q.createdAtFrom)
      if (q.createdAtTo) range.lte = new Date(new Date(q.createdAtTo).setHours(23, 59, 59, 999))
      where.createdAt = range
    }

    const skip = (q.page - 1) * q.limit

    // Filtro espelhado para linhas de recibo — restringe às cobranças do where atual
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lineWhere = { clinicId, manualReceipt: { billing: where as any } }

    const [items, total, aggregate, cashAggregate, breakdown] = await Promise.all([
      prisma.billing.findMany({
        where,
        include: billingInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.billing.count({ where }),
      prisma.billing.aggregate({ where, _sum: { amount: true } }),
      // Recebido Caixa: exclui wallet_credit e wallet_voucher
      prisma.manualReceiptLine.aggregate({
        where: { ...lineWhere, paymentMethod: { notIn: ['wallet_credit', 'wallet_voucher'] } },
        _sum: { amount: true },
      }),
      // Breakdown por forma de pagamento
      prisma.manualReceiptLine.groupBy({
        by: ['paymentMethod'],
        where: lineWhere,
        _sum: { amount: true },
        orderBy: [{ _sum: { amount: 'desc' } }],
      }),
    ])

    return {
      items,
      total,
      page: q.page,
      limit: q.limit,
      totalAmount: aggregate._sum.amount ?? 0,
      totalCashReceived: cashAggregate._sum.amount ?? 0,
      paymentMethodBreakdown: breakdown.map((r) => ({
        paymentMethod: r.paymentMethod,
        total: r._sum.amount ?? 0,
      })),
    }
  }

  async findById(clinicId: string, id: string) {
    return prisma.billing.findFirst({
      where: { id, clinicId },
      include: billingInclude,
    })
  }

  async updateStatus(
    clinicId: string,
    id: string,
    status: string,
    extra?: Partial<{ paidAt: Date; overdueAt: Date; cancelledAt: Date }>,
  ) {
    await prisma.billing.updateMany({
      where: { id, clinicId },
      data: { status: status as never, ...extra, updatedAt: new Date() },
    })
    return prisma.billing.findFirst({ where: { id, clinicId }, include: billingInclude })
  }

  // Cron: mark pending past due_date as overdue
  async markOverdue() {
    const now = new Date()
    return prisma.billing.updateMany({
      where: {
        status: 'pending',
        dueDate: { lt: now },
      },
      data: { status: 'overdue', overdueAt: now },
    })
  }
}
