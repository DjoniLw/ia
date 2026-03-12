import { NotFoundError } from '../../shared/errors/app-error'
import type { LedgerSummaryQuery, ListLedgerQuery } from './ledger.dto'
import { LedgerRepository } from './ledger.repository'

export class LedgerService {
  private repo = new LedgerRepository()

  async list(clinicId: string, q: ListLedgerQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const entry = await this.repo.findById(clinicId, id)
    if (!entry) throw new NotFoundError('LedgerEntry')
    return entry
  }

  async summary(clinicId: string, q: LedgerSummaryQuery) {
    return this.repo.getSummary(clinicId, q)
  }

  /**
   * Creates a credit entry when a payment is confirmed.
   * Called from the domain event handler for `payment.succeeded`.
   */
  async createCreditEntry(data: {
    clinicId: string
    paymentId: string
    amount: number
    billingId?: string
    appointmentId?: string
    customerId?: string
    description?: string
  }) {
    return this.repo.create({
      type: 'credit',
      description: data.description ?? 'Pagamento recebido',
      ...data,
    })
  }
}
