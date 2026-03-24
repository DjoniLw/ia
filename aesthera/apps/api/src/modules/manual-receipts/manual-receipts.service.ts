import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import type { Prisma } from '@prisma/client'
import type { CreateManualReceiptDto } from './manual-receipts.dto'
import { BillingRepository } from '../billing/billing.repository'
import { LedgerService } from '../ledger/ledger.service'
import { WalletService } from '../wallet/wallet.service'

const ledger = new LedgerService()
const wallet = new WalletService()

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

    const totalPaid = dto.lines.reduce((sum, l) => sum + l.amount, 0)

    if (totalPaid < billing.amount) {
      throw new AppError(
        'O total informado é menor que o valor da cobrança',
        400,
        'INSUFFICIENT_PAYMENT',
      )
    }

    const excedente = totalPaid - billing.amount

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

      // 2. Update billing status to paid — use receivedAt for consistency with retroactive receipts
      const effectivePaidAt = dto.receivedAt ? new Date(dto.receivedAt) : new Date()
      await tx.billing.update({
        where: { id: billingId },
        data: { status: 'paid', paidAt: effectivePaidAt },
      })

      // 3. Debit wallet entries used as payment — pass tx to run atomically
      for (const line of dto.lines) {
        if (
          (line.paymentMethod === 'wallet_credit' || line.paymentMethod === 'wallet_voucher') &&
          'walletEntryId' in line && line.walletEntryId
        ) {
          await wallet.use(clinicId, line.walletEntryId, line.amount, billingId, tx)
        }
      }

      // 4. Create ledger credit entries (one per payment line, up to billing.amount)
      let allocatedToLedger = 0
      for (const line of dto.lines) {
        const ledgerAmount = Math.min(line.amount, billing.amount - allocatedToLedger)
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

      // 5. Handle overpayment
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
            },
            tx,
          )
        }
        // cash_change: no action needed — note was added in buildNotes()
      }

      return { receipt, walletEntry }
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
