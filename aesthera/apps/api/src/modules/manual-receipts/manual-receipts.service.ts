import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type { Prisma } from '@prisma/client'
import type { CreateManualReceiptDto } from './manual-receipts.dto'
import { BillingRepository } from '../billing/billing.repository'
import { LedgerService } from '../ledger/ledger.service'
import { WalletService } from '../wallet/wallet.service'
import { PromotionsService } from '../promotions/promotions.service'

const ledger = new LedgerService()
const wallet = new WalletService()
const promotionsSvc = new PromotionsService()

// NOTE: promotionsSvc is used only for pre-validation (validate()) before the transaction.
// Inside the transaction, promotion apply logic is inlined with tx for full atomicity.

export class ManualReceiptsService {
  private billingRepo = new BillingRepository()

  async receive(clinicId: string, billingId: string, dto: CreateManualReceiptDto) {
    const billing = await this.billingRepo.findById(clinicId, billingId)
    if (!billing) throw new NotFoundError('Billing')

    if (!['pending', 'overdue'].includes(billing.status)) {
      throw new AppError(
        'Somente cobranças pendentes ou vencidas podem ser recebidas manualmente',
        400,
        'INVALID_STATUS',
      )
    }

    // Idempotency: check if already has a manual receipt
    const existingReceipt = await prisma.manualReceipt.findUnique({ where: { billingId } })
    if (existingReceipt) {
      throw new AppError('Esta cobrança já foi paga', 409, 'BILLING_ALREADY_PAID')
    }

    // Validate promotion code before entering transaction (fast fail)
    let preValidatedPromotion: Awaited<ReturnType<PromotionsService['validate']>> | null = null
    if (dto.promotionCode && billing.customerId) {
      const serviceIds = billing.appointmentId
        ? (await prisma.appointmentServiceItem.findMany({
            where: { appointment: { id: billing.appointmentId, clinicId } },
            select: { serviceId: true },
          })).map((s: { serviceId: string }) => s.serviceId)
        : []
      preValidatedPromotion = await promotionsSvc.validate(
        clinicId,
        dto.promotionCode,
        billing.amount,
        serviceIds,
        billing.customerId,
      )
    }

    const effectiveBillingAmount = preValidatedPromotion
      ? billing.amount - preValidatedPromotion.discountAmount
      : billing.amount

    const totalPaid = dto.lines.reduce((sum, l) => sum + l.amount, 0)

    if (totalPaid < effectiveBillingAmount) {
      throw new AppError(
        'O total informado é menor que o valor da cobrança',
        400,
        'INSUFFICIENT_PAYMENT',
      )
    }

    const excedente = totalPaid - effectiveBillingAmount

    // When overpaid, overpaymentHandling is required
    if (excedente > 0 && !dto.overpaymentHandling) {
      throw new AppError(
        'Informe como tratar o excedente de pagamento',
        400,
        'OVERPAYMENT_HANDLING_REQUIRED',
      )
    }

    return prisma.$transaction(async (tx) => {
      // 1. Create ManualReceipt — catch P2002 for idempotency under concurrent requests
      const notes = buildNotes(dto, excedente)
      let receipt
      try {
        receipt = await tx.manualReceipt.create({
          data: {
            clinicId,
            billingId,
            totalPaid,
            receivedAt: dto.receivedAt ? new Date(dto.receivedAt) : new Date(),
            notes,
            lines: {
              create: dto.lines.map((line) => ({
                clinicId,
                paymentMethod: line.paymentMethod,
                amount: line.amount,
                walletEntryId: 'walletEntryId' in line ? line.walletEntryId : null,
              })),
            },
          },
          include: { lines: true },
        })
      } catch (e: unknown) {
        if ((e as Prisma.PrismaClientKnownRequestError)?.code === 'P2002') {
          throw new AppError('Esta cobrança já foi paga', 409, 'BILLING_ALREADY_PAID')
        }
        throw e
      }

      // 2. Apply promotion discount atomically using this transaction (ensures rollback consistency)
      let appliedDiscountAmount = 0
      if (dto.promotionCode && billing.customerId && preValidatedPromotion) {
        const promotion = preValidatedPromotion.promotion
        appliedDiscountAmount = preValidatedPromotion.discountAmount

        // Atomic increment FIRST — only if still under maxUses (prevents race condition)
        if (promotion.maxUses !== null) {
          const updated = await tx.promotion.updateMany({
            where: { id: promotion.id, usesCount: { lt: promotion.maxUses } },
            data: { usesCount: { increment: 1 } },
          })
          if (updated.count === 0) {
            throw new AppError('Limite de usos foi atingido concorrentemente.', 409, 'PROMOTION_MAX_USES_REACHED')
          }
        } else {
          await tx.promotion.update({
            where: { id: promotion.id },
            data: { usesCount: { increment: 1 } },
          })
        }

        // Create usage record after increment succeeds
        await tx.promotionUsage.create({
          data: {
            clinicId,
            promotionId: promotion.id,
            customerId: billing.customerId,
            billingId,
            discountAmount: appliedDiscountAmount,
          },
        })
      }

      // Recalculate effective amount inside the tx to ensure ledger uses the real applied discount
      const txEffectiveAmount = billing.amount - appliedDiscountAmount

      // 3. Update billing status to paid — use receivedAt for consistency with retroactive receipts
      const effectivePaidAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date()
      const finalAmount = billing.amount - appliedDiscountAmount
      await tx.billing.update({
        where: { id: billingId },
        data: {
          status: 'paid',
          paidAt: effectivePaidAt,
          ...(appliedDiscountAmount > 0 ? { amount: finalAmount } : {}),
        },
      })

      // RN04 — Se havia sessão de pacote RESERVADA vinculada, liberar de volta para ABERTO
      // (o operador optou por pagar por outro método, não via pacote)
      if (billing.packageSession?.id) {
        // clinicId no WHERE garante isolamento multi-tenant (defesa em profundidade)
        await tx.customerPackageSession.updateMany({
          where: { id: billing.packageSession.id, clinicId },
          data: { appointmentId: null, status: 'ABERTO' },
        })
      }

      // 4. Debit wallet entries used as payment — pass tx to run atomically
      for (const line of dto.lines) {
        if (
          (line.paymentMethod === 'wallet_credit' || line.paymentMethod === 'wallet_voucher') &&
          'walletEntryId' in line && line.walletEntryId
        ) {
          await wallet.use(clinicId, line.walletEntryId, line.amount, billingId, tx)
        }
      }

      // 5. Create ledger credit entries (one per payment line, up to txEffectiveAmount)
      // RN-FIN01: voucher SERVICE_PRESALE não gera entrada no caixa — dinheiro já foi
      // contabilizado quando a pré-venda foi paga. Pular o ledger nesse caso.
      let allocatedToLedger = 0
      for (const line of dto.lines) {
        if (line.paymentMethod === 'wallet_voucher' && 'walletEntryId' in line && line.walletEntryId) {
          const entry = await tx.walletEntry.findUnique({ where: { id: line.walletEntryId } })
          if (entry?.originType === 'SERVICE_PRESALE') continue
        }
        const ledgerAmount = Math.min(line.amount, txEffectiveAmount - allocatedToLedger)
        if (ledgerAmount <= 0) break
        allocatedToLedger += ledgerAmount
        await ledger.createCreditEntry(
          {
            clinicId,
            amount: ledgerAmount,
            billingId,
            appointmentId: billing.appointmentId ?? undefined,
            customerId: billing.customerId ?? undefined,
            description: `Recebimento manual — ${paymentMethodLabel(line.paymentMethod)}`,
            metadata: { source: 'manual_receipt', paymentMethod: line.paymentMethod },
          },
          tx,
        )
      }

      // 6. Handle overpayment
      let walletEntry: { code: string; balance: number } | null = null
      if (excedente > 0 && dto.overpaymentHandling) {
        if (dto.overpaymentHandling.type === 'wallet_credit' || dto.overpaymentHandling.type === 'wallet_voucher') {
          if (!billing.customerId) {
            throw new AppError(
              'Não é possível criar crédito/vale sem cliente associado à cobrança',
              400,
              'MISSING_CUSTOMER',
            )
          }
          const entryType = dto.overpaymentHandling.type === 'wallet_credit' ? 'CREDIT' : 'VOUCHER'
          walletEntry = await wallet.createInternal(
            {
              clinicId,
              customerId: billing.customerId,
              type: entryType,
              value: excedente,
              originType: 'OVERPAYMENT',
              originReference: billingId,
              notes: `Excedente de recebimento — Cobrança ${billingId.slice(0, 8)}`,
              transactionDescription: `Troco gerado no recebimento da cobrança ${billingId.slice(0, 8)}`,
            },
            tx,
          )
        }
        // cash_change: no action needed — note was added in buildNotes()
      }

      // 7. RN11 — Se cobrança de pré-venda (PRESALE): criar WalletEntry SERVICE_PRESALE
      // Gera o "vale de procedimento" que o cliente usa ao concluir o agendamento.
      let serviceVoucherEntry: { code: string; balance: number } | null = null
      if (billing.sourceType === 'PRESALE' && billing.serviceId && billing.customerId) {
        serviceVoucherEntry = await wallet.createInternal(
          {
            clinicId,
            customerId: billing.customerId,
            type: 'VOUCHER',
            value: txEffectiveAmount,
            originType: 'SERVICE_PRESALE',
            originReference: billingId,
            notes: `Vale de procedimento gerado por pré-venda — cobrança ${billingId}`,
            transactionDescription: `Vale de procedimento criado — ${billing.service?.name ?? 'serviço'} (pré-venda)`,
            serviceId: billing.serviceId,
          },
          tx,
        )
      }

      // 8. RN-WP01 — Se cobrança é WALLET_PURCHASE: ativar o wallet entry PENDING vinculado
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((billing.sourceType as any) === 'WALLET_PURCHASE') {
        const pendingEntry = await tx.walletEntry.findFirst({
          where: { clinicId, originReference: billingId, status: 'PENDING' as never },
        })
        if (pendingEntry) {
          await tx.walletEntry.update({
            where: { id: pendingEntry.id },
            data: { status: 'ACTIVE' as never, updatedAt: new Date() },
          })
          await tx.walletTransaction.create({
            data: {
              clinicId,
              walletEntryId: pendingEntry.id,
              type: 'ADJUST' as never,
              value: 0,
              reference: billingId,
              description: 'Vale ativado após pagamento da cobrança',
            },
          })
        }
      }

      return { receipt, walletEntry, serviceVoucherEntry }
    })
  }

  async getReceipt(clinicId: string, billingId: string) {
    const billing = await this.billingRepo.findById(clinicId, billingId)
    if (!billing) throw new NotFoundError('Billing')

    const receipt = await prisma.manualReceipt.findUnique({
      where: { billingId },
      include: { lines: true },
    })
    if (!receipt) throw new NotFoundError('ManualReceipt')
    return receipt
  }
}

function paymentMethodLabel(method: string): string {
  const labels: Record<string, string> = {
    cash: 'Dinheiro',
    pix: 'PIX',
    card: 'Cartão',
    transfer: 'Transferência',
    wallet_credit: 'Crédito na Carteira',
    wallet_voucher: 'Vale',
  }
  return labels[method] ?? method
}

function buildNotes(dto: CreateManualReceiptDto, excedente: number): string | null {
  const parts: string[] = []
  if (dto.notes) parts.push(dto.notes)
  if (
    excedente > 0 &&
    dto.overpaymentHandling?.type === 'cash_change'
  ) {
    const excStr = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
      excedente / 100,
    )
    parts.push(`Troco: ${excStr}`)
  }
  return parts.length > 0 ? parts.join(' | ') : null
}
