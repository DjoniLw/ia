import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import { WalletService } from '../wallet/wallet.service'
import { LedgerService } from '../ledger/ledger.service'
import type {
  CreatePackageDto,
  ListCustomerPackagesQuery,
  ListPackagesQuery,
  ListSoldPackagesQuery,
  PurchasePackageDto,
  UpdatePackageDto,
} from './packages.dto'
import { PackagesRepository } from './packages.repository'

const wallet = new WalletService()
const ledger = new LedgerService()

export class PackagesService {
  private repo = new PackagesRepository()

  async listPackages(clinicId: string, q: ListPackagesQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async getPackage(clinicId: string, id: string) {
    const pkg = await this.repo.findById(clinicId, id)
    if (!pkg) throw new NotFoundError('ServicePackage')
    return pkg
  }

  async createPackage(clinicId: string, dto: CreatePackageDto) {
    // Validate all services belong to the clinic
    const serviceIds = dto.items.map((i) => i.serviceId)
    const services = await prisma.service.findMany({
      where: { id: { in: serviceIds }, clinicId, active: true, deletedAt: null },
    })
    if (services.length !== serviceIds.length) {
      throw new NotFoundError('Service')
    }
    return this.repo.create(clinicId, dto)
  }

  async updatePackage(clinicId: string, id: string, dto: UpdatePackageDto) {
    await this.getPackage(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  /**
   * Purchase a package for a customer — full transactional flow (BLOCO 2).
   * Creates CustomerPackage + sessions + WalletEntry + Billing(paid) + LedgerEntry.
   * Supports idempotency via Idempotency-Key header.
   */
  async purchasePackage(
    clinicId: string,
    packageId: string,
    dto: PurchasePackageDto,
    idempotencyKey: string,
  ) {
    const pkg = await this.getPackage(clinicId, packageId)

    if (!pkg.active) {
      throw new AppError('Pacote inativo', 400, 'PACKAGE_INACTIVE')
    }

    // Idempotency: return existing billing if key was already used
    const existingBilling = await prisma.billing.findFirst({
      where: { clinicId, paymentToken: idempotencyKey },
      include: { customerPackage: { include: { sessions: true } } },
    })
    if (existingBilling) {
      return {
        customerPackageId: existingBilling.customerPackage?.id,
        billingId: existingBilling.id,
        sessions: existingBilling.customerPackage?.sessions ?? [],
      }
    }

    // Verify customer belongs to clinic
    const customer = await prisma.customer.findFirst({
      where: { id: dto.customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    // Backend payment amount validation
    const totalProvided = dto.paymentMethods.reduce((sum, pm) => sum + pm.amount, 0)
    if (totalProvided < pkg.price) {
      throw new AppError(
        'Valor de pagamento insuficiente para o pacote',
        422,
        'PAYMENT_AMOUNT_INSUFFICIENT',
      )
    }

    const troco = totalProvided - pkg.price

    // Compute expiry date
    const expiresAt = pkg.validityDays
      ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000)
      : undefined

    return prisma.$transaction(async (tx) => {
      // 1. Create CustomerPackage
      const customerPackage = await tx.customerPackage.create({
        data: {
          clinicId,
          customerId: dto.customerId,
          packageId,
          expiresAt,
        },
      })

      // 2. Create sessions for each service × quantity
      const sessionData: Array<{ clinicId: string; customerPackageId: string; serviceId: string }> = []
      for (const item of pkg.items) {
        for (let i = 0; i < item.quantity; i++) {
          sessionData.push({ clinicId, customerPackageId: customerPackage.id, serviceId: item.serviceId })
        }
      }
      if (sessionData.length > 0) {
        await tx.customerPackageSession.createMany({ data: sessionData })
      }

      // 3. Create WalletEntry tipo PACKAGE
      const walletEntry = await wallet.createInternal(
        {
          clinicId,
          customerId: dto.customerId,
          type: 'PACKAGE',
          value: pkg.price,
          originType: 'PACKAGE_PURCHASE',
          originReference: packageId,
          notes: `Pacote: ${pkg.name}`,
          transactionDescription: `Pacote adquirido: ${pkg.name}`,
        },
        tx as Parameters<typeof wallet.createInternal>[1],
      )

      // 4. Create Billing with status=paid, sourceType=PACKAGE_SALE
      const notesText = [
        dto.notes,
        troco > 0 ? `Troco: R$ ${(troco / 100).toFixed(2)}` : null,
      ]
        .filter(Boolean)
        .join(' | ')

      const billing = await tx.billing.create({
        data: {
          clinicId,
          customerId: dto.customerId,
          amount: pkg.price,
          status: 'paid',
          sourceType: 'PACKAGE_SALE',
          paymentMethods: dto.paymentMethods.map((pm) => pm.method),
          paymentToken: idempotencyKey,
          dueDate: new Date(),
          paidAt: new Date(),
          notes: notesText || undefined,
        },
      })

      // 5. Link billing to CustomerPackage
      await tx.customerPackage.update({
        where: { id: customerPackage.id },
        data: { billingId: billing.id, walletEntryId: walletEntry.id },
      })

      // 6. Create LedgerEntry (credit)
      await ledger.createCreditEntry(
        {
          clinicId,
          amount: pkg.price,
          billingId: billing.id,
          customerId: dto.customerId,
          description: `Venda de pacote: ${pkg.name}`,
          metadata: { source: 'package_sale', packageId },
        },
        tx as Parameters<typeof ledger.createCreditEntry>[1],
      )

      const sessions = await tx.customerPackageSession.findMany({
        where: { customerPackageId: customerPackage.id },
      })

      return {
        customerPackageId: customerPackage.id,
        billingId: billing.id,
        sessions,
      }
    })
  }

  async listCustomerPackages(clinicId: string, customerId: string, q?: ListCustomerPackagesQuery) {
    return this.repo.findCustomerPackages(clinicId, customerId, q)
  }

  async listSoldPackages(clinicId: string, q: ListSoldPackagesQuery) {
    return this.repo.findSoldPackages(clinicId, q)
  }

  /**
   * Redeem a session — marks the session as FINALIZADO and optionally links an appointment.
   */
  async redeemSession(clinicId: string, sessionId: string, appointmentId?: string) {
    const session = await this.repo.findSessionById(clinicId, sessionId)
    if (!session) throw new NotFoundError('CustomerPackageSession')

    if (session.status === 'FINALIZADO') {
      throw new AppError('Sessão já foi utilizada', 400, 'SESSION_ALREADY_REDEEMED')
    }

    if (session.status === 'EXPIRADO') {
      throw new AppError('Sessão expirada', 400, 'PACKAGE_EXPIRED')
    }

    // Check package expiry
    const cp = await this.repo.findCustomerPackageById(clinicId, session.customerPackageId)
    if (cp?.expiresAt && cp.expiresAt < new Date()) {
      throw new AppError('Pacote expirado', 400, 'PACKAGE_EXPIRED')
    }

    return this.repo.redeemSession(sessionId, appointmentId)
  }
}
