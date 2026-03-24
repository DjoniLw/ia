import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type {
  CreateAccountsPayableDto,
  ListAccountsPayableQuery,
  PayAccountsPayableDto,
  UpdateAccountsPayableDto,
} from './accounts-payable.dto'
import { AccountsPayableRepository } from './accounts-payable.repository'
import { LedgerService } from '../ledger/ledger.service'

const ledger = new LedgerService()

export class AccountsPayableService {
  private repo = new AccountsPayableRepository()

  async list(clinicId: string, q: ListAccountsPayableQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const entry = await this.repo.findById(clinicId, id)
    if (!entry) throw new NotFoundError('AccountsPayable')
    return entry
  }

  async getSummary(clinicId: string) {
    return this.repo.getSummary(clinicId)
  }

  async create(clinicId: string, dto: CreateAccountsPayableDto) {
    return this.repo.create({
      clinicId,
      description: dto.description,
      supplierName: dto.supplierName ?? null,
      category: dto.category ?? null,
      amount: dto.amount,
      dueDate: new Date(dto.dueDate),
      notes: dto.notes ?? null,
      originType: 'manual',
    })
  }

  /**
   * Create an AccountsPayable entry automatically from a supply purchase.
   * Called by SupplyPurchasesService after creating a purchase.
   */
  async createFromSupplyPurchase(data: {
    clinicId: string
    description: string
    supplierName?: string | null
    amount: number
    dueDate: Date
    originReference: string
  }) {
    return this.repo.create({
      clinicId: data.clinicId,
      description: data.description,
      supplierName: data.supplierName ?? null,
      category: 'Insumos',
      amount: data.amount,
      dueDate: data.dueDate,
      originType: 'supply_purchase',
      originReference: data.originReference,
    })
  }

  async update(clinicId: string, id: string, dto: UpdateAccountsPayableDto) {
    const entry = await this.get(clinicId, id)
    if (entry.status !== 'PENDING') {
      throw new AppError('Somente contas pendentes podem ser editadas', 400, 'INVALID_STATUS')
    }
    return this.repo.update(clinicId, id, {
      ...(dto.description !== undefined && { description: dto.description }),
      ...(dto.supplierName !== undefined && { supplierName: dto.supplierName ?? null }),
      ...(dto.category !== undefined && { category: dto.category ?? null }),
      ...(dto.amount !== undefined && { amount: dto.amount }),
      ...(dto.dueDate !== undefined && { dueDate: new Date(dto.dueDate) }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
    })
  }

  async pay(clinicId: string, id: string, dto: PayAccountsPayableDto) {
    const entry = await this.get(clinicId, id)
    if (!['PENDING', 'OVERDUE'].includes(entry.status)) {
      throw new AppError(
        'Somente contas pendentes ou vencidas podem ser pagas',
        400,
        'INVALID_STATUS',
      )
    }

    const paidAt = dto.paidAt ? new Date(dto.paidAt) : new Date()
    return prisma.$transaction(async (tx) => {
      await tx.accountsPayable.updateMany({
        where: { id, clinicId },
        data: { status: 'PAID', paidAt, paymentMethod: dto.paymentMethod },
      })

      await ledger.createDebitEntry(
        {
          clinicId,
          amount: entry.amount,
          description: `Contas a Pagar — ${entry.description}${entry.supplierName ? ` (${entry.supplierName})` : ''}`,
          metadata: { source: 'accounts_payable', accountsPayableId: entry.id },
        },
        tx,
      )

      return tx.accountsPayable.findFirst({ where: { id, clinicId } })
    })
  }

  async cancel(clinicId: string, id: string) {
    const entry = await this.get(clinicId, id)
    if (!['PENDING', 'OVERDUE'].includes(entry.status)) {
      throw new AppError(
        'Somente contas pendentes ou vencidas podem ser canceladas',
        400,
        'INVALID_STATUS',
      )
    }
    return this.repo.markCancelled(clinicId, id)
  }

  /** Cron job: mark overdue entries for the given clinic. */
  async runOverdueCron(clinicId: string) {
    const result = await this.repo.markOverdueBatch(clinicId)
    return { updated: result.count }
  }
}
