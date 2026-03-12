import { AppError, NotFoundError } from '../../shared/errors/app-error'
import type { CancelBillingDto, ListBillingQuery } from './billing.dto'
import { BillingRepository } from './billing.repository'

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
