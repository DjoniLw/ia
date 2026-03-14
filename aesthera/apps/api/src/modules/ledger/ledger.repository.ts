import { prisma } from '../../database/prisma/client'
import type { LedgerSummaryQuery, ListLedgerQuery } from './ledger.dto'

const ledgerInclude = {
  payment: {
    select: { id: true, gateway: true, method: true, status: true, gatewayPaymentId: true },
  },
  billing: {
    select: { id: true, amount: true },
  },
  appointment: {
    select: {
      id: true,
      scheduledAt: true,
      service: { select: { id: true, name: true } },
      professional: { select: { id: true, name: true } },
    },
  },
  customer: { select: { id: true, name: true, email: true } },
} as const

export class LedgerRepository {
  async findAll(clinicId: string, q: ListLedgerQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.type) where.type = q.type
    if (q.customerId) where.customerId = q.customerId
    if (q.appointmentId) where.appointmentId = q.appointmentId
    if (q.billingId) where.billingId = q.billingId

    if (q.from || q.to) {
      const range: Record<string, Date> = {}
      if (q.from) range.gte = new Date(q.from)
      if (q.to) {
        const toDate = new Date(q.to)
        toDate.setUTCHours(23, 59, 59, 999)
        range.lte = toDate
      }
      where.createdAt = range
    }

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.ledgerEntry.findMany({
        where,
        include: ledgerInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.ledgerEntry.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.ledgerEntry.findFirst({
      where: { id, clinicId },
      include: ledgerInclude,
    })
  }

  async getSummary(clinicId: string, q: LedgerSummaryQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.customerId) where.customerId = q.customerId

    if (q.from || q.to) {
      const range: Record<string, Date> = {}
      if (q.from) range.gte = new Date(q.from)
      if (q.to) {
        const toDate = new Date(q.to)
        toDate.setUTCHours(23, 59, 59, 999)
        range.lte = toDate
      }
      where.createdAt = range
    }

    const [credits, debits] = await Promise.all([
      prisma.ledgerEntry.aggregate({
        where: { ...where, type: 'credit' },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.ledgerEntry.aggregate({
        where: { ...where, type: 'debit' },
        _sum: { amount: true },
        _count: true,
      }),
    ])

    const totalCredits = credits._sum.amount ?? 0
    const totalDebits = debits._sum.amount ?? 0

    return {
      totalCredits,
      totalDebits,
      netBalance: totalCredits - totalDebits,
      creditCount: credits._count,
      debitCount: debits._count,
    }
  }

  async create(data: {
    clinicId: string
    type: 'credit' | 'debit'
    amount: number
    paymentId?: string | null
    billingId?: string | null
    appointmentId?: string | null
    customerId?: string | null
    description?: string
    metadata?: Record<string, unknown>
  }) {
    const { metadata, ...rest } = data
    return prisma.ledgerEntry.create({
      data: {
        ...rest,
        ...(metadata !== undefined && { metadata: metadata as object }),
      },
    })
  }
}
