import { prisma } from '../../database/prisma/client'
import type { CreateFieldDto, CreateRecordDto, ListRecordsQuery, UpdateFieldDto } from './body-measurements.dto'

export class BodyMeasurementsRepository {
  // ─── Fields ────────────────────────────────────────────────────────────────

  async listFields(clinicId: string, activeOnly = true) {
    return prisma.bodyMeasurementField.findMany({
      where: { clinicId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { order: 'asc' },
    })
  }

  async countActiveFields(clinicId: string): Promise<number> {
    return prisma.bodyMeasurementField.count({
      where: { clinicId, active: true },
    })
  }

  async findFieldById(id: string, clinicId: string) {
    return prisma.bodyMeasurementField.findFirst({
      where: { id, clinicId },
    })
  }

  async createField(clinicId: string, dto: CreateFieldDto) {
    return prisma.bodyMeasurementField.create({
      data: {
        clinicId,
        name: dto.name,
        unit: dto.unit,
        order: dto.order ?? 0,
        active: true,
      },
    })
  }

  async updateField(id: string, clinicId: string, dto: UpdateFieldDto) {
    await prisma.bodyMeasurementField.updateMany({
      where: { id, clinicId },
      data: dto,
    })
    return prisma.bodyMeasurementField.findFirst({ where: { id, clinicId } })
  }

  async deactivateField(id: string, clinicId: string) {
    await prisma.bodyMeasurementField.updateMany({
      where: { id, clinicId },
      data: { active: false },
    })
    return prisma.bodyMeasurementField.findFirst({ where: { id, clinicId } })
  }

  // ─── Records ───────────────────────────────────────────────────────────────

  async listRecords(clinicId: string, q: ListRecordsQuery) {
    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.bodyMeasurementRecord.findMany({
        where: { clinicId, customerId: q.customerId },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: q.limit,
        include: {
          values: {
            include: { field: { select: { id: true, name: true, unit: true } } },
          },
          files: {
            where: { deletedAt: null },
            select: {
              id: true,
              name: true,
              mimeType: true,
              size: true,
              category: true,
              uploadedAt: true,
            },
          },
        },
      }),
      prisma.bodyMeasurementRecord.count({
        where: { clinicId, customerId: q.customerId },
      }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findRecordById(id: string, clinicId: string) {
    return prisma.bodyMeasurementRecord.findFirst({
      where: { id, clinicId },
    })
  }

  async createRecord(
    clinicId: string,
    createdById: string,
    dto: CreateRecordDto,
  ) {
    return prisma.bodyMeasurementRecord.create({
      data: {
        clinicId,
        customerId: dto.customerId,
        recordedAt: new Date(dto.recordedAt),
        notes: dto.notes,
        createdById,
        values: {
          create: dto.values.map((v) => ({
            clinicId,
            fieldId: v.fieldId,
            value: v.value,
          })),
        },
      },
      include: {
        values: {
          include: { field: { select: { id: true, name: true, unit: true } } },
        },
      },
    })
  }

  async linkFilesToRecord(recordId: string, fileIds: string[], clinicId: string, customerId: string) {
    if (fileIds.length === 0) return
    await prisma.customerFile.updateMany({
      where: { id: { in: fileIds }, clinicId, customerId, deletedAt: null },
      data: { recordId },
    })
  }

  async deleteRecord(id: string, clinicId: string) {
    await prisma.bodyMeasurementRecord.deleteMany({
      where: { id, clinicId },
    })
  }

  async findCustomerInClinic(customerId: string, clinicId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
      select: { id: true, clinicId: true },
    })
  }

  /** Verifica se todos os fieldIds pertencem à clínica */
  async validateFieldsOwnership(fieldIds: string[], clinicId: string): Promise<boolean> {
    const count = await prisma.bodyMeasurementField.count({
      where: { id: { in: fieldIds }, clinicId },
    })
    return count === fieldIds.length
  }

  /** RN18: professional já realizou atendimento confirmado com o cliente */
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
