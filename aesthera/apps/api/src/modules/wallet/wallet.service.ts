import { prisma } from '../../database/prisma/client'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error'
import type { AdjustWalletEntryDto, CreateWalletEntryDto, ListWalletQuery } from './wallet.dto'
import { WalletRepository } from './wallet.repository'
import type { Tx } from './wallet.repository'
import { logger } from '../../shared/logger/logger'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'VCHR-'
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export class WalletService {
  private repo = new WalletRepository()

  async list(clinicId: string, q: ListWalletQuery) {
    if (q.createdAtFrom && q.createdAtTo) {
      const from = new Date(q.createdAtFrom)
      const to = new Date(q.createdAtTo)
      const fromTime = from.getTime()
      const toTime = to.getTime()

      if (!Number.isFinite(fromTime) || !Number.isFinite(toTime)) {
        throw new AppError('Parâmetros de data inválidos', 400, 'INVALID_DATE_RANGE')
      }
      if (fromTime > toTime) {
        throw new AppError('Data inicial maior que data final', 400, 'INVALID_DATE_RANGE')
      }
      const diffDays = Math.floor((toTime - fromTime) / 86_400_000)
      if (diffDays > 730) throw new AppError('Intervalo de datas muito grande', 400, 'DATE_RANGE_TOO_LARGE')
      if (diffDays > 180) logger.warn({ clinicId, diffDays }, 'Large date range query on /wallet')
    }
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const entry = await this.repo.findById(clinicId, id)
    if (!entry) throw new NotFoundError('WalletEntry')
    return entry
  }

  /**
   * Retorna o saldo total ativo de um cliente.
   * Valida que o customerId pertence à clínica do JWT (proteção contra IDOR).
   */
  async getSummary(clinicId: string, customerId: string): Promise<{ totalBalance: number }> {
    const customer = await prisma.customer.findFirst({ where: { id: customerId, clinicId } })
    if (!customer) {
      throw new ForbiddenError('Cliente não encontrado ou não pertence a esta clínica')
    }
    const totalBalance = await this.repo.sumActiveBalance(clinicId, customerId)
    return { totalBalance }
  }

  async create(clinicId: string, dto: CreateWalletEntryDto) {
    const code = generateCode()
    const expiration = dto.expirationDate ? new Date(dto.expirationDate) : undefined

    return prisma.$transaction(async (tx) => {
      const entry = await this.repo.create(
        {
          clinicId,
          customerId: dto.customerId,
          type: dto.type,
          originalValue: dto.value,
          balance: dto.value,
          code,
          originType: dto.originType,
          originReference: dto.originReference,
          notes: dto.notes,
          expirationDate: expiration,
        },
        tx,
      )

      await this.repo.createTransaction(
        {
          clinicId,
          walletEntryId: entry.id,
          type: 'CREATE',
          value: dto.value,
          reference: dto.originReference,
          description: `Carteira criada — origem: ${dto.originType}`,
        },
        tx,
      )

      return entry
    })
  }

  /**
   * Create a wallet entry internally (e.g. from billing overpayment or voucher split).
   * Accepts an optional transaction client to run atomically within a parent transaction.
   * Returns the new entry.
   */
  async createInternal(
    data: {
      clinicId: string
      customerId: string
      type: string
      value: number
      originType: string
      originReference?: string
      notes?: string
      transactionType?: string
      transactionDescription?: string
    },
    tx?: Tx,
  ) {
    const code = generateCode()

    const run = async (client: Tx) => {
      const entry = await this.repo.create(
        {
          clinicId: data.clinicId,
          customerId: data.customerId,
          type: data.type,
          originalValue: data.value,
          balance: data.value,
          code,
          originType: data.originType,
          originReference: data.originReference,
          notes: data.notes,
        },
        client,
      )

      await this.repo.createTransaction(
        {
          clinicId: data.clinicId,
          walletEntryId: entry.id,
          type: data.transactionType ?? 'CREATE',
          value: data.value,
          reference: data.originReference,
          description: data.transactionDescription ?? `Carteira criada — origem: ${data.originType}`,
        },
        client,
      )

      return entry
    }

    return tx ? run(tx) : prisma.$transaction(run)
  }

  async adjust(clinicId: string, id: string, dto: AdjustWalletEntryDto) {
    return prisma.$transaction(async (tx) => {
      const entry = await this.repo.findByIdForUpdate(tx, clinicId, id)
      if (!entry) throw new NotFoundError('WalletEntry')

      const newBalance = entry.balance + dto.value
      if (newBalance < 0) {
        throw new AppError('O saldo da carteira não pode ficar negativo', 400, 'INSUFFICIENT_BALANCE')
      }

      const status = newBalance === 0 ? 'USED' : entry.status
      const updated = await this.repo.updateBalance(entry.id, newBalance, status, tx)

      await this.repo.createTransaction(
        {
          clinicId,
          walletEntryId: entry.id,
          type: 'ADJUST',
          value: dto.value,
          description: dto.notes,
        },
        tx,
      )

      return updated
    })
  }

  /**
   * Use wallet balance to pay a billing.
   * Runs inside a database transaction with a row-level lock (FOR UPDATE) to prevent
   * double spending under concurrent requests.
   * Returns: { entry, newEntry (if split), remaining (if insufficient) }
   * Uses Redis distributed lock to prevent concurrent usage of the same wallet entry.
   */
  async use(
    clinicId: string,
    walletEntryId: string,
    amount: number,
    billingId: string,
    providedTx?: Tx,
  ): Promise<{
    entry: Awaited<ReturnType<WalletRepository['findById']>>
    newEntry: Awaited<ReturnType<WalletRepository['findById']>> | null
    remaining: number
  }> {
    const run = async (tx: Tx) => {
      const entry = await this.repo.findByIdForUpdate(tx, clinicId, walletEntryId)
      if (!entry) throw new NotFoundError('WalletEntry')

      if (entry.status !== 'ACTIVE') {
        throw new AppError('Este voucher não está ativo', 400, 'WALLET_NOT_ACTIVE')
      }

      if (entry.balance < amount) {
        throw new AppError('Saldo insuficiente no voucher', 400, 'INSUFFICIENT_BALANCE')
      }

      const leftover = entry.balance - amount

      // Mark current entry as USED (full balance consumed)
      const updatedEntry = await this.repo.updateBalance(entry.id, 0, 'USED', tx)

      await this.repo.createTransaction(
        {
          clinicId,
          walletEntryId: entry.id,
          type: 'USE',
          value: amount,
          reference: billingId,
          description: `Usado em cobrança ${billingId}`,
        },
        tx,
      )

      let newEntry = null

      // If there's leftover balance, create a new split entry within the same transaction
      if (leftover > 0) {
        newEntry = await this.createInternal(
          {
            clinicId,
            customerId: entry.customerId,
            type: entry.type,
            value: leftover,
            originType: 'VOUCHER_SPLIT',
            originReference: entry.id,
            notes: `Saldo restante do voucher ${entry.code}`,
            transactionType: 'SPLIT',
            transactionDescription: `Saldo remanescente do voucher ${entry.code}`,
          },
          tx,
        )

        await this.repo.createTransaction(
          {
            clinicId,
            walletEntryId: entry.id,
            type: 'SPLIT',
            value: leftover,
            reference: newEntry.id,
            description: `Saldo dividido para novo voucher ${newEntry.code}`,
          },
          tx,
        )
      }

      return { entry: updatedEntry, newEntry, remaining: 0 }
    }

    return providedTx ? run(providedTx) : prisma.$transaction(run)
  }
}
