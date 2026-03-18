import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { prisma } from '../../database/prisma/client'
import { WalletService } from '../wallet/wallet.service'
import type { CreatePackageDto, ListPackagesQuery, UpdatePackageDto } from './packages.dto'
import { PackagesRepository } from './packages.repository'

const wallet = new WalletService()

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
   * Purchase a package for a customer — creates a CustomerPackage and a wallet entry (PACKAGE type).
   */
  async purchasePackage(clinicId: string, customerId: string, packageId: string) {
    const pkg = await this.getPackage(clinicId, packageId)

    if (!pkg.active) {
      throw new AppError('Package is not active', 400, 'PACKAGE_INACTIVE')
    }

    // Verify customer belongs to clinic
    const customer = await prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
    if (!customer) throw new NotFoundError('Customer')

    // Compute expiry date
    const expiresAt = pkg.validityDays
      ? new Date(Date.now() + pkg.validityDays * 24 * 60 * 60 * 1000)
      : undefined

    // Create wallet entry for the package value
    const walletEntry = await wallet.createInternal({
      clinicId,
      customerId,
      type: 'PACKAGE',
      value: pkg.price,
      originType: 'PACKAGE_PURCHASE',
      originReference: packageId,
      notes: `Pacote: ${pkg.name}`,
      transactionDescription: `Pacote adquirido: ${pkg.name}`,
    })

    // Create customer package record
    const customerPackage = await this.repo.createCustomerPackage({
      clinicId,
      customerId,
      packageId,
      walletEntryId: walletEntry.id,
      expiresAt,
    })

    // Pre-generate session slots for each service × quantity
    const sessions: Array<{ clinicId: string; customerPackageId: string; serviceId: string }> = []
    for (const item of pkg.items) {
      for (let i = 0; i < item.quantity; i++) {
        sessions.push({ clinicId, customerPackageId: customerPackage.id, serviceId: item.serviceId })
      }
    }
    if (sessions.length > 0) {
      await this.repo.createSessions(sessions)
    }

    return customerPackage
  }

  async listCustomerPackages(clinicId: string, customerId: string) {
    return this.repo.findCustomerPackages(clinicId, customerId)
  }

  /**
   * Redeem a session — marks the session as used and optionally links an appointment.
   */
  async redeemSession(clinicId: string, sessionId: string, appointmentId?: string) {
    const session = await this.repo.findSessionById(clinicId, sessionId)
    if (!session) throw new NotFoundError('CustomerPackageSession')

    if (session.usedAt) {
      throw new AppError('Session has already been redeemed', 400, 'SESSION_ALREADY_REDEEMED')
    }

    // Check package expiry
    const cp = await this.repo.findCustomerPackageById(clinicId, session.customerPackageId)
    if (cp?.expiresAt && cp.expiresAt < new Date()) {
      throw new AppError('Package has expired', 400, 'PACKAGE_EXPIRED')
    }

    return this.repo.redeemSession(sessionId, appointmentId)
  }
}
