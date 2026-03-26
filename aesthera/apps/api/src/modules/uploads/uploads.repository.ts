import { prisma } from '../../database/prisma/client'

export class UploadsRepository {
  async findCustomerInClinic(customerId: string, clinicId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: { id: true, clinicId: true, bodyDataConsentAt: true },
    })
  }

  /** Cria registro CustomerFile com status PENDING (chamado no presign, antes do upload ao R2). */
  async createPending(
    clinicId: string,
    uploadedById: string,
    storageKey: string,
    customerId: string,
    name: string,
    mimeType: string,
    size: number,
    category: string,
  ) {
    return prisma.customerFile.create({
      data: {
        clinicId,
        customerId,
        name,
        mimeType,
        size,
        storageKey,
        category: category as any,
        status: 'PENDING',
        uploadedById,
      },
    })
  }

  /** Busca registro PENDING por id e clinicId (cross-tenant safe). */
  async findPendingById(id: string, clinicId: string) {
    return prisma.customerFile.findFirst({
      where: { id, clinicId, status: 'PENDING', deletedAt: null },
      select: { id: true, storageKey: true, mimeType: true, customerId: true, name: true, size: true, category: true },
    })
  }

  /** Atualiza status PENDING → CONFIRMED e retorna o registro atualizado. */
  async confirmPending(id: string, clinicId: string) {
    await prisma.customerFile.updateMany({
      where: { id, clinicId, status: 'PENDING' },
      data: { status: 'CONFIRMED' },
    })
    return prisma.customerFile.findFirst({ where: { id, clinicId } })
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

  /** Verifica vínculo RN18: professional já realizou atendimento confirmado com o cliente */
  async professionalHasAppointmentWithCustomer(
    professionalId: string,
    customerId: string,
    clinicId: string,
  ): Promise<boolean> {
    const count = await prisma.appointment.count({
      where: {
        professionalId,
        customerId,
        clinicId,
        status: { in: ['confirmed', 'in_progress', 'completed'] },
      },
    })
    return count > 0
  }
}
