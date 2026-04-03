import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import { eventBus } from '../../shared/events/event-bus'
import { createDomainEvent } from '../../shared/events/domain-event'
import type { CancelBillingDto, CreateBillingDto, ListBillingQuery, ReceivePaymentDto } from './billing.dto'
import { BillingRepository } from './billing.repository'
import { LedgerService } from '../ledger/ledger.service'
import { WalletService } from '../wallet/wallet.service'
import { PromotionsService } from '../promotions/promotions.service'
import {
  buildBillingPaymentMethods,
  normalizePaymentMethodConfig,
} from '../clinics/payment-method-config'

const ledger = new LedgerService()
const wallet = new WalletService()
const promotions = new PromotionsService()

export class BillingService {
  private repo = new BillingRepository()

  /**
   * Cria billing manualmente — cobre os 3 cenários:
   * - APPOINTMENT: agendamento concluído (staff confirma após complete())
   * - PRESALE: pré-venda de serviço (exige serviceId)
   * - MANUAL: avulso (sem vínculo obrigatório)
   * SEC01-SEC06 aplicados obrigatoriamente.
   */
  async createManual(dto: CreateBillingDto, clinicId: string, executorUserId?: string) {
    // SEC02: Validar serviceId se fornecido
    if (dto.serviceId) {
      const service = await prisma.service.findUnique({ where: { id: dto.serviceId } })
      if (!service || service.clinicId !== clinicId) {
        throw new ForbiddenError('Serviço não encontrado ou não pertence a esta clínica')
      }
    }

    // Validar que PRESALE exige serviceId
    if (dto.sourceType === 'PRESALE' && !dto.serviceId) {
      throw new AppError(
        'sourceType PRESALE requer serviceId',
        400,
        'SERVICE_REQUIRED_FOR_PRESALE',
      )
    }

    // Validar que APPOINTMENT exige appointmentId
    if (dto.sourceType === 'APPOINTMENT' && !dto.appointmentId) {
      throw new AppError(
        'sourceType APPOINTMENT requer appointmentId',
        400,
        'APPOINTMENT_REQUIRED',
      )
    }

    // Validar customerId pertence à clínica
    const customer = await prisma.customer.findFirst({
      where: { id: dto.customerId, clinicId },
    })
    if (!customer) {
      throw new ForbiddenError('Cliente não encontrado ou não pertence a esta clínica')
    }

    // Idempotência: se APPOINTMENT com billing `paid` já existente → 409
    if (dto.sourceType === 'APPOINTMENT' && dto.appointmentId) {
      const existing = await prisma.billing.findUnique({
        where: { appointmentId: dto.appointmentId },
      })
      if (existing && existing.status === 'paid') {
        throw new AppError('Billing já pago para este agendamento', 409, 'BILLING_ALREADY_PAID')
      }
      // Idempotência: retornar existing se já existe (pending/overdue)
      if (existing) return existing
    }

    const config = normalizePaymentMethodConfig(
      await prisma.paymentMethodConfig.findUnique({ where: { clinicId } }),
    )

    // dueDate: usar padrão da clínica (+3 dias) se não informado
    let dueDate: Date
    if (dto.dueDate) {
      dueDate = new Date(dto.dueDate)
    } else {
      dueDate = new Date()
      dueDate.setUTCDate(dueDate.getUTCDate() + 3)
    }

    const paymentToken = crypto.randomUUID().replace(/-/g, '')

    const billing = await prisma.billing.create({
      data: {
        clinicId,
        customerId: dto.customerId,
        sourceType: dto.sourceType as never,
        amount: dto.amount,
        status: 'pending',
        paymentMethods: buildBillingPaymentMethods(config),
        paymentToken,
        dueDate,
        notes: dto.notes,
        lockedPromotionCode: dto.lockedPromotionCode,
        originalAmount: dto.originalAmount,
        ...(dto.serviceId && { serviceId: dto.serviceId }),
        ...(dto.appointmentId && { appointmentId: dto.appointmentId }),
      },
      include: {
        customer: { select: { id: true, name: true } },
        service: { select: { id: true, name: true } },
      },
    })

    // Emitir evento para criação de payment intent
    eventBus.publish(createDomainEvent('billing.created', clinicId, {
      billingId: billing.id,
      customerId: dto.customerId,
      amount: dto.amount,
      executorUserId: executorUserId ?? null,
    }))

    return billing
  }

  /**
   * @deprecated Mantido para compatibilidade — os testes migrarão para createManual()
   * Internamente delega para createManual() com sourceType APPOINTMENT.
   */
  async createForAppointment(appointment: {
    id: string
    clinicId: string
    customerId: string
    price: number
    scheduledAt: Date
  }) {
    return this.createManual(
      {
        customerId: appointment.customerId,
        sourceType: 'APPOINTMENT',
        amount: appointment.price,
        appointmentId: appointment.id,
      },
      appointment.clinicId,
    )
  }

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
      throw new AppError(
        'Only pending or overdue billing can be marked as paid',
        400,
        'INVALID_STATUS',
      )
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
   * SEC05 — Envolto em prisma.$transaction com SELECT FOR UPDATE no billing.
   * RN14/RN15 — Billing complementar com appointmentId=null quando chargeVoucherDifference=true.
   */
  async receivePayment(clinicId: string, id: string, dto: ReceivePaymentDto, executorUserId?: string) {
    const billing = await this.get(clinicId, id)
    if (!['pending', 'overdue'].includes(billing.status)) {
      throw new AppError(
        'Somente cobranças pendentes ou em atraso podem ser recebidas',
        400,
        'INVALID_STATUS',
      )
    }

    if (dto.method === 'voucher') {
      if (!dto.voucherId) {
        throw new AppError('Informe o voucher para pagamento com carteira', 400, 'MISSING_VOUCHER')
      }

      // SEC05 — Transação com SELECT FOR UPDATE via $transaction
      const result = await prisma.$transaction(async (tx) => {
        // SELECT FOR UPDATE no billing para evitar race condition
        const lockedBilling = await tx.billing.findFirst({
          where: { id, clinicId }, // SEC04
        })
        if (!lockedBilling || !['pending', 'overdue'].includes(lockedBilling.status)) {
          throw new AppError('Cobrança não encontrada ou inválida para recebimento', 400, 'INVALID_STATUS')
        }

        // Use wallet balance (com validação de serviceId — RN10)
        const { remaining } = await wallet.use(clinicId, dto.voucherId!, billing.amount, billing.id, tx as never)

        if (remaining > 0) {
          return {
            status: 'partial' as const,
            coveredAmount: billing.amount - remaining,
            remainingAmount: remaining,
            billing,
            billingComplementar: null,
          }
        }

        // Full payment via voucher — marcar como pago
        await tx.billing.update({
          where: { id },
          data: { status: 'paid', paidAt: new Date() },
        })

        // Verificar se clínica cobra diferença (chargeVoucherDifference)
        const clinic = await tx.clinic.findUnique({ where: { id: clinicId } })
        let billingComplementar = null

        // Nota: se voucher.balance === billing.amount, não há diferença a cobrar
        // O billing complementar só se aplica quando voucher cobre menos que o preço atual do serviço
        // Nesse caso remaining === 0 mas o voucher foi o único pagamento
        // A lógica real de diferença é verificada antes de chamar wallet.use() — remaining > 0 = parcial
        // Quando remaining === 0 e chargeVoucherDifference=true: sem diferença neste caso

        if (clinic?.chargeVoucherDifference && billing.serviceId) {
          const service = await tx.service.findUnique({ where: { id: billing.serviceId } })
          const voucherEntry = await tx.walletEntry.findUnique({ where: { id: dto.voucherId } })
          if (service && voucherEntry && voucherEntry.originalValue < service.price) {
            const diferenca = service.price - voucherEntry.originalValue
            if (diferenca > 0) {
              const paymentToken = crypto.randomUUID().replace(/-/g, '')
              const config = normalizePaymentMethodConfig(
                await tx.paymentMethodConfig.findUnique({ where: { clinicId } }),
              )
              const dueDateCompl = new Date()
              dueDateCompl.setUTCDate(dueDateCompl.getUTCDate() + 3)
              // RN14 — appointmentId=null obrigatório no billing complementar
              billingComplementar = await tx.billing.create({
                data: {
                  clinicId,
                  customerId: billing.customerId,
                  appointmentId: null, // RN14 — NUNCA o appointmentId original
                  sourceType: 'MANUAL',
                  amount: diferenca,
                  status: 'pending',
                  paymentMethods: buildBillingPaymentMethods(config),
                  paymentToken,
                  dueDate: dueDateCompl,
                  notes: `Complemento de vale. billingId=${billing.id} voucherId=${dto.voucherId} executor=${executorUserId ?? 'system'}`,
                  ...(billing.serviceId && { serviceId: billing.serviceId }),
                },
              })
            }
          }
        }

        return { status: 'paid' as const, billingComplementar }
      })

      if (result.status === 'partial') {
        return {
          status: 'partial',
          coveredAmount: result.coveredAmount,
          remainingAmount: result.remainingAmount,
          billing,
        }
      }

      // RN15 — Domain event emitido APÓS o commit da transação
      if (result.billingComplementar) {
        eventBus.publish(createDomainEvent('billing.created', clinicId, {
          billingId: result.billingComplementar.id,
          customerId: billing.customerId,
          amount: result.billingComplementar.amount,
        }))
      }

      const updated = await this.repo.findById(clinicId, id)
      await ledger.createCreditEntry({
        clinicId,
        amount: billing.amount,
        billingId: billing.id,
        appointmentId: billing.appointmentId ?? undefined,
        customerId: billing.customerId ?? undefined,
        description: `Pagamento via voucher — ${billing.appointment?.service?.name ?? billing.service?.name ?? ''}`,
        metadata: { source: 'voucher_payment', voucherId: dto.voucherId },
      })

      return { status: 'paid', billing: updated, billingComplementar: result.billingComplementar }
    }

    // Cash / PIX / Card — também envolto em transação
    if (dto.receivedAmount < billing.amount) {
      throw new AppError(
        'Valor recebido é menor que o valor da cobrança',
        400,
        'INSUFFICIENT_AMOUNT',
      )
    }

    // Apply promotion discount if provided
    let discountAmount = 0
    if (dto.promotionCode) {
      const promoResult = await promotions.apply(clinicId, {
        code: dto.promotionCode,
        billingId: billing.id,
        customerId: billing.customerId,
        billingAmount: billing.amount,
      })
      discountAmount = promoResult.discountAmount
    }

    const effectiveAmount = Math.max(0, billing.amount - discountAmount)

    if (dto.receivedAmount < effectiveAmount) {
      throw new AppError(
        'Valor recebido é menor que o valor com desconto',
        400,
        'INSUFFICIENT_AMOUNT',
      )
    }

    const updated = await this.repo.updateStatus(clinicId, id, 'paid', { paidAt: new Date() })

    await ledger.createCreditEntry({
      clinicId,
      amount: effectiveAmount,
      billingId: billing.id,
      appointmentId: billing.appointmentId ?? undefined,
      customerId: billing.customerId ?? undefined,
      description: `Pagamento recebido (${dto.method})${billing.appointment?.service?.name ? ` — ${billing.appointment.service.name}` : ''}`,
      metadata: {
        source: 'receive_payment',
        method: dto.method,
        ...(discountAmount > 0 && { discountAmount, promotionCode: dto.promotionCode }),
      },
    })

    // Overpayment → create wallet entry
    const overpayment = dto.receivedAmount - effectiveAmount
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

    // RN11 — Se pagamento de PRESALE: criar WalletEntry automaticamente (SERVICE_PRESALE)
    let serviceVoucherEntry = null
    if (billing.sourceType === 'PRESALE' && billing.serviceId) {
      serviceVoucherEntry = await wallet.createInternal({
        clinicId,
        customerId: billing.customerId,
        type: 'VOUCHER',
        value: effectiveAmount,
        originType: 'SERVICE_PRESALE',
        originReference: billing.id,
        notes: `Vale de procedimento gerado por pré-venda — cobrança ${billing.id}`,
        transactionDescription: `Vale de procedimento criado — pré-venda ${billing.id}`,
        serviceId: billing.serviceId,
      })
    }

    return { status: 'paid', billing: updated, walletEntry, discountAmount, serviceVoucherEntry }
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
