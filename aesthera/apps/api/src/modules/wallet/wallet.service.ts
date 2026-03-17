import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { redis } from '../../database/redis/client'
import type { AdjustWalletEntryDto, CreateWalletEntryDto, ListWalletQuery } from './wallet.dto'
import { WalletRepository } from './wallet.repository'

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
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const entry = await this.repo.findById(clinicId, id)
    if (!entry) throw new NotFoundError('WalletEntry')
    return entry
  }

  async create(clinicId: string, dto: CreateWalletEntryDto) {
    const code = generateCode()
    const expiration = dto.expirationDate ? new Date(dto.expirationDate) : undefined

    const entry = await this.repo.create({
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
    })

    await this.repo.createTransaction({
      clinicId,
      walletEntryId: entry.id,
      type: 'CREATE',
      value: dto.value,
      reference: dto.originReference,
      description: `Carteira criada — origem: ${dto.originType}`,
    })

    return entry
  }

  /**
   * Create a wallet entry internally (e.g. from billing overpayment or voucher split).
   * Returns the new entry.
   */
  async createInternal(data: {
    clinicId: string
    customerId: string
    type: string
    value: number
    originType: string
    originReference?: string
    notes?: string
    transactionType?: string
    transactionDescription?: string
  }) {
    const code = generateCode()
    const entry = await this.repo.create({
      clinicId: data.clinicId,
      customerId: data.customerId,
      type: data.type,
      originalValue: data.value,
      balance: data.value,
      code,
      originType: data.originType,
      originReference: data.originReference,
      notes: data.notes,
    })

    await this.repo.createTransaction({
      clinicId: data.clinicId,
      walletEntryId: entry.id,
      type: data.transactionType ?? 'CREATE',
      value: data.value,
      reference: data.originReference,
      description: data.transactionDescription ?? `Carteira criada — origem: ${data.originType}`,
    })

    return entry
  }

  async adjust(clinicId: string, id: string, dto: AdjustWalletEntryDto) {
    const entry = await this.get(clinicId, id)

    const newBalance = entry.balance + dto.value
    if (newBalance < 0) {
      throw new AppError('O saldo da carteira não pode ficar negativo', 400, 'INSUFFICIENT_BALANCE')
    }

    const status = newBalance === 0 ? 'USED' : entry.status
    const updated = await this.repo.updateBalance(entry.id, newBalance, status)

    await this.repo.createTransaction({
      clinicId,
      walletEntryId: entry.id,
      type: 'ADJUST',
      value: dto.value,
      description: dto.notes,
    })

    return updated
  }

  /**
   * Use wallet balance to pay a billing.
   * Returns: { entry, newEntry (if split), remaining (if insufficient) }
   * Uses Redis distributed lock to prevent concurrent usage of the same wallet entry.
   */
  async use(
    clinicId: string,
    walletEntryId: string,
    amount: number,
    billingId: string,
  ): Promise<{
    entry: Awaited<ReturnType<WalletRepository['findById']>>
    newEntry: Awaited<ReturnType<WalletRepository['findById']>> | null
    remaining: number
  }> {
    const lockKey = `wallet:lock:${walletEntryId}`
    const lockValue = crypto.randomUUID()
    const lockTTL = 5 // seconds

    const acquired = await redis.set(lockKey, lockValue, 'EX', lockTTL, 'NX')
    if (!acquired) {
      throw new AppError('Wallet entry is being processed, try again', 409, 'WALLET_LOCKED')
    }

    try {
      const entry = await this.repo.findById(clinicId, walletEntryId)
      if (!entry) throw new NotFoundError('WalletEntry')

      if (entry.status !== 'ACTIVE') {
        throw new AppError('Este voucher não está ativo', 400, 'WALLET_NOT_ACTIVE')
      }

      if (entry.balance <= 0) {
        throw new AppError('Saldo insuficiente no voucher', 400, 'INSUFFICIENT_BALANCE')
      }

      const used = Math.min(entry.balance, amount)
      const remaining = amount - used
      const leftover = entry.balance - used

      // Mark current entry as USED (full balance consumed)
      const updatedEntry = await this.repo.updateBalance(entry.id, 0, 'USED')

      await this.repo.createTransaction({
        clinicId,
        walletEntryId: entry.id,
        type: 'USE',
        value: used,
        reference: billingId,
        description: `Usado em cobrança ${billingId}`,
      })

      let newEntry = null

      // If there's leftover balance, create a new split entry
      if (leftover > 0) {
        newEntry = await this.createInternal({
          clinicId,
          customerId: entry.customerId,
          type: entry.type,
          value: leftover,
          originType: 'VOUCHER_SPLIT',
          originReference: entry.id,
          notes: `Saldo restante do voucher ${entry.code}`,
          transactionType: 'SPLIT',
          transactionDescription: `Saldo remanescente do voucher ${entry.code}`,
        })

        await this.repo.createTransaction({
          clinicId,
          walletEntryId: entry.id,
          type: 'SPLIT',
          value: leftover,
          reference: newEntry.id,
          description: `Saldo dividido para novo voucher ${newEntry.code}`,
        })
      }

      return { entry: updatedEntry, newEntry, remaining }
    } finally {
      // Release lock only if we own it (atomic via Lua)
      const releaseScript = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `
      await redis.eval(releaseScript, 1, lockKey, lockValue)
    }
  }
}
