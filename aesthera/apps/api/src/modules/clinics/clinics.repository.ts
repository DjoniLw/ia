import type { UpdateClinicDto, UpdateSmtpSettingsDto, UpdateWhatsappSettingsDto } from './clinics.dto'
import { prisma } from '../../database/prisma/client'
import type { PaymentMethodConfigShape } from './payment-method-config'

export class ClinicsRepository {
  async findById(clinicId: string) {
    return prisma.clinic.findUnique({
      where: { id: clinicId },
      include: { businessHours: { orderBy: { dayOfWeek: 'asc' } } },
    })
  }

  async update(clinicId: string, data: UpdateClinicDto) {
    return prisma.clinic.update({
      where: { id: clinicId },
      data: {
        name: data.name,
        phone: data.phone,
        document: data.document ?? null,
        timezone: data.timezone,
        address: data.address as object | undefined,
        settings: data.settings as object | undefined,
        ...(data.chargeVoucherDifference !== undefined
          ? { chargeVoucherDifference: data.chargeVoucherDifference }
          : {}),
        updatedAt: new Date(),
      },
    })
  }

  async findByDocument(document: string) {
    return prisma.clinic.findUnique({
      where: { document },
      select: { id: true, name: true },
    })
  }

  async getBusinessHours(clinicId: string) {
    return prisma.businessHour.findMany({
      where: { clinicId },
      orderBy: { dayOfWeek: 'asc' },
    })
  }

  async setBusinessHours(
    clinicId: string,
    hours: Array<{
      dayOfWeek: number
      openTime: string
      closeTime: string
      isOpen: boolean
    }>,
  ) {
    return prisma.$transaction(
      hours.map((h) =>
        prisma.businessHour.upsert({
          where: { clinicId_dayOfWeek: { clinicId, dayOfWeek: h.dayOfWeek } },
          create: { clinicId, ...h },
          update: { openTime: h.openTime, closeTime: h.closeTime, isOpen: h.isOpen },
        }),
      ),
    )
  }

  async findPaymentMethodConfig(clinicId: string) {
    return prisma.paymentMethodConfig.findUnique({
      where: { clinicId },
      select: {
        pixEnabled: true,
        boletoEnabled: true,
        cardEnabled: true,
        installmentsEnabled: true,
        installmentsMaxMonths: true,
        installmentsMinAmount: true,
        duplicataEnabled: true,
        duplicataDaysInterval: true,
        duplicataMaxInstallments: true,
      },
    })
  }

  async upsertPaymentMethodConfig(clinicId: string, data: PaymentMethodConfigShape) {
    return prisma.paymentMethodConfig.upsert({
      where: { clinicId },
      create: {
        clinicId,
        ...data,
      },
      update: {
        ...data,
        updatedAt: new Date(),
      },
    })
  }

  async updateWhatsapp(clinicId: string, data: Pick<UpdateWhatsappSettingsDto, 'whatsappInstance'>) {
    return prisma.clinic.update({
      where: { id: clinicId },
      data: { whatsappInstance: data.whatsappInstance ?? null, updatedAt: new Date() },
    })
  }

  async updateSmtp(clinicId: string, data: Pick<UpdateSmtpSettingsDto, 'smtpHost' | 'smtpPort' | 'smtpUser' | 'smtpPass' | 'smtpFrom' | 'smtpSecure' | 'enabled'>) {
    return prisma.clinic.update({
      where: { id: clinicId },
      data: {
        smtpHost: data.smtpHost ?? null,
        smtpPort: data.smtpPort ?? null,
        smtpUser: data.smtpUser ?? null,
        smtpPass: data.smtpPass ?? null,
        smtpFrom: data.smtpFrom ?? null,
        smtpSecure: data.smtpSecure ?? true,
        smtpEnabled: data.enabled ?? true,
        updatedAt: new Date(),
      },
    })
  }
}
