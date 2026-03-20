import type { UpdateClinicDto } from './clinics.dto'
import { prisma } from '../../database/prisma/client'

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
}
