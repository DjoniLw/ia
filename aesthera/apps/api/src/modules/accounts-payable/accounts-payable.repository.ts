import { prisma } from '../../database/prisma/client'
import type { ListAccountsPayableQuery } from './accounts-payable.dto'

export class AccountsPayableRepository {
  async findAll(clinicId: string, q: ListAccountsPayableQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      ...(q.status && { status: q.status }),
      ...(q.supplierName && { supplierName: { contains: q.supplierName, mode: 'insensitive' as const } }),
      ...(q.category && { category: { contains: q.category, mode: 'insensitive' as const } }),
      ...((q.from || q.to) && {
        dueDate: {
          ...(q.from && { gte: new Date(`${q.from}T00:00:00.000Z`) }),
          ...(q.to && { lte: new Date(`${q.to}T23:59:59.999Z`) }),
        },
      }),
    }

    const [items, total] = await Promise.all([
      prisma.accountsPayable.findMany({ where, skip, take: q.limit, orderBy: { dueDate: 'asc' } }),
      prisma.accountsPayable.count({ where }),
    ])

    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.accountsPayable.findFirst({ where: { id, clinicId } })
  }

  async create(data: {
    clinicId: string
    description: string
    supplierName?: string | null
    category?: string | null
    amount: number
    dueDate: Date
    notes?: string | null
    originType?: string | null
    originReference?: string | null
  }) {
    return prisma.accountsPayable.create({ data })
  }

  async update(_clinicId: string, id: string, data: Partial<{
    description: string
    supplierName: string | null
    category: string | null
    amount: number
    dueDate: Date
    notes: string | null
  }>) {
    return prisma.accountsPayable.update({ where: { id }, data })
  }

  async markPaid(_clinicId: string, id: string, paymentMethod: string, paidAt: Date) {
    return prisma.accountsPayable.update({
      where: { id },
      data: { status: 'PAID', paidAt, paymentMethod },
    })
  }

  async markCancelled(_clinicId: string, id: string) {
    return prisma.accountsPayable.update({
      where: { id },
      data: { status: 'CANCELLED' },
    })
  }

  /** Cron: mark overdue entries */
  async markOverdueBatch(clinicId?: string) {
    const where = {
      status: 'PENDING' as const,
      dueDate: { lt: new Date() },
      ...(clinicId ? { clinicId } : {}),
    }
    return prisma.accountsPayable.updateMany({ where, data: { status: 'OVERDUE' } })
  }

  async getSummary(clinicId: string) {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)

    const [pendingAgg, overdueAgg, paidMonthAgg] = await Promise.all([
      prisma.accountsPayable.aggregate({
        where: { clinicId, status: 'PENDING' },
        _sum: { amount: true },
      }),
      prisma.accountsPayable.aggregate({
        where: { clinicId, status: 'OVERDUE' },
        _sum: { amount: true },
      }),
      prisma.accountsPayable.aggregate({
        where: {
          clinicId,
          status: 'PAID',
          paidAt: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      }),
    ])

    return {
      totalPending: pendingAgg._sum.amount ?? 0,
      totalOverdue: overdueAgg._sum.amount ?? 0,
      totalPaidThisMonth: paidMonthAgg._sum.amount ?? 0,
    }
  }
}
