import { prisma } from '../../database/prisma/client'
import type { ConfirmUploadDto } from './uploads.dto'

export class UploadsRepository {
  async findCustomerInClinic(customerId: string, clinicId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: { id: true, clinicId: true, bodyDataConsentAt: true },
    })
  }

  async create(
    clinicId: string,
    uploadedById: string,
    dto: ConfirmUploadDto,
  ) {
    return prisma.customerFile.create({
      data: {
        clinicId,
        customerId: dto.customerId,
        name: dto.name,
        mimeType: dto.mimeType,
        size: dto.size,
        storageKey: dto.storageKey,
        category: dto.category as any,
        uploadedById,
      },
    })
  }

  async findByIdInClinic(id: string, clinicId: string) {
    return prisma.customerFile.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: {
        id: true,
        clinicId: true,
        customerId: true,
        storageKey: true,
        mimeType: true,
        name: true,
        category: true,
        size: true,
        uploadedAt: true,
      },
    })
  }

  async softDelete(id: string, clinicId: string) {
    return prisma.customerFile.updateMany({
      where: { id, clinicId },
      data: { deletedAt: new Date() },
    })
  }

  /** Verifica vínculo RN18: professional já realizou atendimento com o cliente (RN18) */
  async professionalHasAppointmentWithCustomer(
    professionalId: string,
    customerId: string,
    clinicId: string,
  ): Promise<boolean> {
    const count = await prisma.appointment.count({
      where: { professionalId, customerId, clinicId },
    })
    return count > 0
  }
}
