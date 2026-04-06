import { prisma } from '../../database/prisma/client'
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error'
import type { AdjustWalletEntryDto, CreateWalletEntryDto, ListWalletQuery } from './wallet.dto'
import { WalletRepository } from './wallet.repository'
import type { Tx } from './wallet.repository'
import { logger } from '../../shared/logger/logger'
import { randomUUID } from 'crypto'

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = 'VCHR-'
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

function buildWalletCreateDescription(originType: string, originReference?: string): string {
  const ref = originReference ? ` (${originReference.slice(0, 8)})` : ''
  switch (originType) {
    case 'OVERPAYMENT':          return `Troco de recebimento em excesso${ref}`
    case 'SERVICE_PRESALE':      return `Vale de procedimento gerado por pré-venda${ref}`
    case 'VOUCHER_SPLIT':        return `Saldo remanescente de voucher${ref}`
    case 'CASHBACK':             return `Cashback gerado${ref}`
    case 'MANUAL':               return `Crédito adicionado manualmente${ref}`
    case 'GIFT':                 return `Presente / Brinde concedido${ref}`
    case 'REFUND':               return `Estorno creditado${ref}`
    case 'CASHBACK_PROMOTION':   return `Cashback de promoção${ref}`
    case 'PACKAGE_PURCHASE':     return `Crédito de compra de pacote${ref}`
    default:                     return `Crédito gerado${ref}`
  }
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

    // Enriquece vale SERVICE_PRESALE com as formas de pagamento da cobrança origem
    let billingPaymentLines: Array<{ paymentMethod: string; amount: number }> | undefined
    if (entry.originType === 'SERVICE_PRESALE' && entry.originReference) {
      const receipt = await prisma.manualReceipt.findUnique({
        where: { billingId: entry.originReference },
        include: { lines: { select: { paymentMethod: true, amount: true } } },
      })
      if (receipt) {
        billingPaymentLines = receipt.lines.map((l) => ({ paymentMethod: l.paymentMethod, amount: l.amount }))
      }
    }

    return { ...entry, billingPaymentLines }
  }

  /**
   * Retorna vouchers SERVICE_PRESALE ativos de um cliente, opcionalmente filtrados por serviceId.
   * SEC03 — Valida que o customerId pertence à clinicId do JWT antes de retornar dados.
   */
  async findActiveServiceVouchers(clinicId: string, customerId: string, serviceId?: string) {
    // SEC03 — Validar que o customerId pertence à clínica
    const customer = await prisma.customer.findFirst({ where: { id: customerId, clinicId } })
    if (!customer) {
      throw new ForbiddenError('Cliente não encontrado ou não pertence a esta clínica')
    }

    return prisma.walletEntry.findMany({
      where: {
        clinicId,
        customerId,
        originType: 'SERVICE_PRESALE',
        status: 'ACTIVE',
        OR: [{ expirationDate: null }, { expirationDate: { gte: new Date() } }],
        ...(serviceId ? { serviceId } : {}),
      },
      select: {
        id: true,
        serviceId: true,
        balance: true,
        expirationDate: true,
        code: true,
        service: { select: { id: true, name: true } },
      },
    })
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
      // Gerar cobrança que precisa ser paga para o vale ficar ativo
      const paymentToken = randomUUID().replace(/-/g, '')
      const dueDate = new Date()
      dueDate.setUTCDate(dueDate.getUTCDate() + 3)

      const billing = await tx.billing.create({
        data: {
          clinicId,
          customerId: dto.customerId,
          sourceType: 'WALLET_PURCHASE' as never,
          amount: dto.value,
          status: 'pending',
          paymentMethods: ['pix', 'cash', 'card', 'transfer'],
          paymentToken,
          dueDate,
          notes: dto.notes ? `Venda de ${dto.type === 'CREDIT' ? 'crédito' : 'voucher'}: ${dto.notes}` : `Venda de ${dto.type === 'CREDIT' ? 'crédito' : 'voucher'}`,
        },
        select: { id: true, amount: true, status: true, dueDate: true, sourceType: true },
      })

      const entry = await this.repo.create(
        {
          clinicId,
          customerId: dto.customerId,
          type: dto.type,
          originalValue: dto.value,
          balance: dto.value,
          code,
          originType: dto.originType,
          originReference: billing.id,   // link para ativar quando billing for pago
          notes: dto.notes,
          expirationDate: expiration,
          status: 'PENDING',             // ativo apenas após pagamento da cobrança
        },
        tx,
      )

      await this.repo.createTransaction(
        {
          clinicId,
          walletEntryId: entry.id,
          type: 'CREATE',
          value: dto.value,
          reference: billing.id,
          description: buildWalletCreateDescription(dto.originType, billing.id) + ' — aguardando pagamento',
        },
        tx,
      )

      return { entry, billing }
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
      serviceId?: string
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
          ...(data.serviceId ? { serviceId: data.serviceId } : {}),
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
          description: data.transactionDescription ?? buildWalletCreateDescription(data.originType, data.originReference),
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
   * SEC04 — Busca billing por { id, clinicId } para proteção multi-tenant.
   * RN10 — Validação de serviceId: voucher com serviceId só pode ser usado em billing com mesmo serviceId.
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

      // Verificar se voucher expirou
      if (entry.expirationDate && new Date(entry.expirationDate) < new Date()) {
        throw new AppError('Este voucher está vencido', 400, 'VOUCHER_EXPIRED')
      }

      // RN10 — Se voucher tem serviceId, validar que billing tem o mesmo serviceId
      // RN-PV01 — Vale SERVICE_PRESALE não pode ser usado para pagar uma cobrança PRESALE
      //            (pré-venda não pode ser paga com outra pré-venda)
      if ((entry as { originType?: string }).originType === 'SERVICE_PRESALE' || (entry as { serviceId?: string | null }).serviceId) {
        // SEC04 — Buscar billing por { id, clinicId }
        const billing = await tx.billing.findFirst({ where: { id: billingId, clinicId } })
        if (!billing) throw new NotFoundError('Billing')

        // RN-PV01: bloquear uso de SERVICE_PRESALE para pagar cobrança PRESALE
        if (
          (entry as { originType?: string }).originType === 'SERVICE_PRESALE' &&
          billing.sourceType === 'PRESALE'
        ) {
          throw new AppError(
            'Vale de pré-venda de serviço não pode ser utilizado para pagar outra pré-venda',
            400,
            'PRESALE_VOUCHER_CANNOT_PAY_PRESALE',
          )
        }

        if ((entry as { serviceId?: string | null }).serviceId && billing.serviceId !== (entry as { serviceId?: string | null }).serviceId) {
          throw new AppError(
            'Este vale não pode ser utilizado para este serviço',
            400,
            'VOUCHER_NOT_APPLICABLE_FOR_SERVICE',
          )
        }
      }

      // SERVICE_PRESALE: o serviço já foi pago na pré-venda; não importa o valor da cobrança.
      // Consumir o saldo disponível integralmente e marcar a cobrança como paga.
      const isServicePresale = (entry as { originType?: string }).originType === 'SERVICE_PRESALE'
      if (!isServicePresale && entry.balance < amount) {
        throw new AppError('Saldo insuficiente no voucher', 400, 'INSUFFICIENT_BALANCE')
      }

      // Para SERVICE_PRESALE, usar o saldo real do voucher (não o valor da cobrança)
      const usedAmount = isServicePresale ? entry.balance : amount
      const leftover = entry.balance - usedAmount

      // Mark current entry as USED (full balance consumed)
      const updatedEntry = await this.repo.updateBalance(entry.id, 0, 'USED', tx)

      await this.repo.createTransaction(
        {
          clinicId,
          walletEntryId: entry.id,
          type: 'USE',
          value: usedAmount,
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
