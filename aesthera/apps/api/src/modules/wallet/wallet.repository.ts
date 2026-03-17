import type { Prisma } from '@prisma/client'
import { prisma } from '../../database/prisma/client'
import type { ListWalletQuery } from './wallet.dto'

export type Tx = Prisma.TransactionClient

const walletEntryInclude = {
  customer: { select: { id: true, name: true, email: true, phone: true } },
  transactions: { orderBy: { createdAt: 'desc' as const }, take: 50 },
} as const

export class WalletRepository {
  async findAll(clinicId: string, q: ListWalletQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.customerId) where.customerId = q.customerId
    if (q.type) where.type = q.type
    if (q.status) where.status = q.status

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.walletEntry.findMany({
        where,
        include: walletEntryInclude,
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.walletEntry.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.walletEntry.findFirst({
      where: { id, clinicId },
      include: walletEntryInclude,
    })
  }

  /**
   * Find a wallet entry and acquire a row-level lock (FOR UPDATE).
   * Must be called inside a database transaction to prevent concurrent modifications.
   */
  async findByIdForUpdate(tx: Tx, clinicId: string, id: string) {
    await tx.$queryRaw`SELECT id FROM wallet_entries WHERE id = ${id} AND clinic_id = ${clinicId} FOR UPDATE`
    return tx.walletEntry.findFirst({
      where: { id, clinicId },
      include: walletEntryInclude,
    })
  }

  async findByCode(clinicId: string, code: string) {
    return prisma.walletEntry.findFirst({
      where: { code, clinicId },
      include: walletEntryInclude,
    })
  }

  async create(
    data: {
      clinicId: string
      customerId: string
      type: string
      originalValue: number
      balance: number
      code: string
      originType: string
      originReference?: string
      notes?: string
      expirationDate?: Date
    },
    tx?: Tx,
  ) {
    const client = tx ?? prisma
    return client.walletEntry.create({
      data: {
        clinicId: data.clinicId,
        customerId: data.customerId,
        type: data.type as never,
        originalValue: data.originalValue,
        balance: data.balance,
        code: data.code,
        originType: data.originType as never,
        originReference: data.originReference,
        notes: data.notes,
        expirationDate: data.expirationDate,
        status: 'ACTIVE',
      },
      include: walletEntryInclude,
    })
  }

  async updateBalance(id: string, balance: number, status?: string, tx?: Tx) {
    const client = tx ?? prisma
    return client.walletEntry.update({
      where: { id },
      data: { balance, ...(status ? { status: status as never } : {}), updatedAt: new Date() },
      include: walletEntryInclude,
    })
  }

  async createTransaction(
    data: {
      clinicId: string
      walletEntryId: string
      type: string
      value: number
      reference?: string
      description?: string
    },
    tx?: Tx,
  ) {
    const client = tx ?? prisma
    return client.walletTransaction.create({
      data: {
        clinicId: data.clinicId,
        walletEntryId: data.walletEntryId,
        type: data.type as never,
        value: data.value,
        reference: data.reference,
        description: data.description,
      },
    })
  }
}
