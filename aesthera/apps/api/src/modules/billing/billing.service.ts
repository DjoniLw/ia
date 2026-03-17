import { AppError, NotFoundError } from '../../shared/errors/app-error'
import type { CancelBillingDto, ListBillingQuery, ReceivePaymentDto } from './billing.dto'
import { BillingRepository } from './billing.repository'
import { LedgerService } from '../ledger/ledger.service'
import { WalletService } from '../wallet/wallet.service'

const ledger = new LedgerService()
const wallet = new WalletService()

export class BillingService {
  private repo = new BillingRepository()

  async list(clinicId: string, q: ListBillingQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const billing = await this.repo.findById(clinicId, id)
    if (!billing) throw new NotFoundError('Billing')
    return billing
  }

  async cancel(clinicId: string, id: string, _dto: CancelBillingDto) {
    const billing = await this.get(clinicId, id)
    if (!['pending', 'overdue'].includes(billing.status)) {
      throw new AppError('Only pending or overdue billing can be cancelled', 400, 'INVALID_STATUS')
    }
    return this.repo.updateStatus(clinicId, id, 'cancelled', { cancelledAt: new Date() })
  }

  async markPaid(clinicId: string, id: string) {
    const billing = await this.get(clinicId, id)
    if (!['pending', 'overdue'].includes(billing.status)) {
      throw new AppError('Only pending or overdue billing can be marked as paid', 400, 'INVALID_STATUS')
    }
    const updated = await this.repo.updateStatus(clinicId, id, 'paid', { paidAt: new Date() })

    // Create a ledger credit entry for the manual payment
    await ledger.createCreditEntry({
      clinicId,
      amount: billing.amount,
      billingId: billing.id,
      appointmentId: billing.appointmentId ?? undefined,
      customerId: billing.customerId ?? undefined,
      description: `Cobrança recebida${billing.appointment?.service?.name ? ` — ${billing.appointment.service.name}` : ''}`,
      metadata: { source: 'manual_mark_paid' },
    })

    return updated
  }

  /**
   * Full payment flow with method selection, overpayment handling and voucher usage.
   */
  async receivePayment(clinicId: string, id: string, dto: ReceivePaymentDto) {
    const billing = await this.get(clinicId, id)
    if (!['pending', 'overdue'].includes(billing.status)) {
      throw new AppError('Somente cobranças pendentes ou em atraso podem ser recebidas', 400, 'INVALID_STATUS')
    }

    if (dto.method === 'voucher') {
      if (!dto.voucherId) {
        throw new AppError('Informe o voucher para pagamento com carteira', 400, 'MISSING_VOUCHER')
      }

      // Use wallet balance
      const { remaining } = await wallet.use(clinicId, dto.voucherId, billing.amount, billing.id)

      if (remaining > 0) {
        // Voucher didn't cover full amount — return partial info so FE can handle
        return {
          status: 'partial',
          coveredAmount: billing.amount - remaining,
          remainingAmount: remaining,
          billing,
        }
      }

      // Full payment via voucher
      const updated = await this.repo.updateStatus(clinicId, id, 'paid', { paidAt: new Date() })
      await ledger.createCreditEntry({
        clinicId,
        amount: billing.amount,
        billingId: billing.id,
        appointmentId: billing.appointmentId ?? undefined,
        customerId: billing.customerId ?? undefined,
        description: `Pagamento via voucher — ${billing.appointment?.service?.name ?? ''}`,
        metadata: { source: 'voucher_payment', voucherId: dto.voucherId },
      })

      return { status: 'paid', billing: updated }
    }

    // Cash / PIX / Card
    if (dto.receivedAmount < billing.amount) {
      throw new AppError('Valor recebido é menor que o valor da cobrança', 400, 'INSUFFICIENT_AMOUNT')
    }

    const updated = await this.repo.updateStatus(clinicId, id, 'paid', { paidAt: new Date() })

    await ledger.createCreditEntry({
      clinicId,
      amount: billing.amount,
      billingId: billing.id,
      appointmentId: billing.appointmentId ?? undefined,
      customerId: billing.customerId ?? undefined,
      description: `Pagamento recebido (${dto.method})${billing.appointment?.service?.name ? ` — ${billing.appointment.service.name}` : ''}`,
      metadata: { source: 'receive_payment', method: dto.method },
    })

    // Overpayment → create wallet entry
    const overpayment = dto.receivedAmount - billing.amount
    let walletEntry = null
    if (overpayment > 0) {
      walletEntry = await wallet.createInternal({
        clinicId,
        customerId: billing.customerId,
        type: 'VOUCHER',
        value: overpayment,
        originType: 'OVERPAYMENT',
        originReference: billing.id,
        notes: `Troco da cobrança ${billing.id}`,
        transactionDescription: `Voucher gerado por troco — cobrança ${billing.id}`,
      })
    }

    return { status: 'paid', billing: updated, walletEntry }
  }

  async getPaymentLink(clinicId: string, id: string) {
    const billing = await this.get(clinicId, id)
    return {
      id: billing.id,
      paymentLink: billing.paymentLink,
      paymentToken: billing.paymentToken,
      amount: billing.amount,
      status: billing.status,
      dueDate: billing.dueDate,
    }
  }

  // Called by cron job (e.g. every hour)
  async runOverdueCron() {
    const result = await this.repo.markOverdue()
    return { updated: result.count }
  }
}
