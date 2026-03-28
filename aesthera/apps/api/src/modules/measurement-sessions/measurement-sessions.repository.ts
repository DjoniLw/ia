import { prisma } from '../../database/prisma/client'
import type { CreateSessionDto, ListSessionsQuery, UpdateSessionDto } from './measurement-sessions.dto'

const SESSION_INCLUDE = {
  sheetRecords: {
    include: {
      sheet: { select: { id: true, name: true } },
      values: {
        include: {
          field: { select: { id: true, name: true, unit: true, inputType: true } },
        },
      },
      tabularValues: {
        include: {
          field: { select: { id: true, name: true, inputType: true } },
          sheetColumn: { select: { id: true, name: true, unit: true, order: true } },
        },
      },
    },
  },
  files: {
    where: { deletedAt: null as null },
    select: {
      id: true,
      name: true,
      mimeType: true,
      size: true,
      category: true,
      uploadedAt: true,
    },
  },
}

export class MeasurementSessionsRepository {
  async listSessions(clinicId: string, q: ListSessionsQuery) {
    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.measurementSession.findMany({
        where: { clinicId, customerId: q.customerId },
        orderBy: { recordedAt: 'desc' },
        skip,
        take: q.limit,
        include: SESSION_INCLUDE,
      }),
      prisma.measurementSession.count({
        where: { clinicId, customerId: q.customerId },
      }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findSessionById(id: string, clinicId: string) {
    return prisma.measurementSession.findFirst({ where: { id, clinicId } })
  }

  async findCustomerInClinic(customerId: string, clinicId: string) {
    return prisma.customer.findFirst({
      where: { id: customerId, clinicId, deletedAt: null },
    })
  }

  async validateSheetsOwnership(sheetIds: string[], clinicId: string): Promise<boolean> {
    const count = await prisma.measurementSheet.count({
      where: { id: { in: sheetIds }, clinicId },
    })
    return count === sheetIds.length
  }

  async validateFieldsOwnership(fieldIds: string[], clinicId: string): Promise<boolean> {
    if (fieldIds.length === 0) return true
    const count = await prisma.measurementField.count({
      where: { id: { in: fieldIds }, clinicId },
    })
    return count === fieldIds.length
  }

  async validateColumnsOwnership(
    columnIds: string[],
    sheetIdsMap: Map<string, string>, // columnId → sheetId
  ): Promise<boolean> {
    if (columnIds.length === 0) return true
    const entries = Array.from(sheetIdsMap.entries())
    for (const [colId, sheetId] of entries) {
      const col = await prisma.measurementSheetColumn.findFirst({
        where: { id: colId, sheetId },
      })
      if (!col) return false
    }
    return true
  }

  async createSession(
    clinicId: string,
    createdById: string,
    dto: CreateSessionDto,
  ) {
    return prisma.$transaction(async (tx) => {
      const session = await tx.measurementSession.create({
        data: {
          clinicId,
          customerId: dto.customerId,
          recordedAt: new Date(dto.recordedAt),
          notes: dto.notes,
          createdById,
        },
      })

      for (const sr of dto.sheetRecords) {
        const record = await tx.measurementSheetRecord.create({
          data: { sessionId: session.id, sheetId: sr.sheetId },
        })

        if (sr.values.length > 0) {
          await tx.measurementValue.createMany({
            data: sr.values.map((v) => ({
              sheetRecordId: record.id,
              fieldId: v.fieldId,
              value: v.value,
            })),
          })
        }

        if (sr.tabularValues.length > 0) {
          await tx.measurementTabularValue.createMany({
            data: sr.tabularValues.map((v) => ({
              sheetRecordId: record.id,
              fieldId: v.fieldId,
              sheetColumnId: v.columnId,
              value: v.value,
            })),
          })
        }
      }

      // Associar arquivos à sessão
      if (dto.fileIds.length > 0) {
        await tx.customerFile.updateMany({
          where: { id: { in: dto.fileIds }, clinicId },
          data: { measurementSessionId: session.id },
        })
      }

      return tx.measurementSession.findFirst({
        where: { id: session.id },
        include: SESSION_INCLUDE,
      })
    })
  }

  async updateSession(
    id: string,
    clinicId: string,
    dto: UpdateSessionDto,
  ) {
    return prisma.$transaction(async (tx) => {
      // Atualizar campos básicos
      await tx.measurementSession.updateMany({
        where: { id, clinicId },
        data: {
          ...(dto.recordedAt !== undefined && { recordedAt: new Date(dto.recordedAt) }),
          ...(dto.notes !== undefined && { notes: dto.notes }),
        },
      })

      // Se sheetRecords fornecidos, reconstruir (delete + recreate)
      if (dto.sheetRecords !== undefined) {
        // Buscar sheetRecords existentes
        const existing = await tx.measurementSheetRecord.findMany({
          where: { sessionId: id },
          select: { id: true },
        })
        const existingIds = existing.map((e) => e.id)

        // Deletar valores antigos
        await tx.measurementValue.deleteMany({ where: { sheetRecordId: { in: existingIds } } })
        await tx.measurementTabularValue.deleteMany({ where: { sheetRecordId: { in: existingIds } } })
        await tx.measurementSheetRecord.deleteMany({ where: { sessionId: id } })

        // Recriar
        for (const sr of dto.sheetRecords) {
          const record = await tx.measurementSheetRecord.create({
            data: { sessionId: id, sheetId: sr.sheetId },
          })
          if (sr.values.length > 0) {
            await tx.measurementValue.createMany({
              data: sr.values.map((v) => ({
                sheetRecordId: record.id,
                fieldId: v.fieldId,
                value: v.value,
              })),
            })
          }
          if (sr.tabularValues.length > 0) {
            await tx.measurementTabularValue.createMany({
              data: sr.tabularValues.map((v) => ({
                sheetRecordId: record.id,
                fieldId: v.fieldId,
                sheetColumnId: v.columnId,
                value: v.value,
              })),
            })
          }
        }
      }

      // Atualizar arquivos
      if (dto.fileIds !== undefined) {
        // Desvincular arquivos atuais
        await tx.customerFile.updateMany({
          where: { measurementSessionId: id, clinicId },
          data: { measurementSessionId: null },
        })
        // Vincular novos arquivos
        if (dto.fileIds.length > 0) {
          await tx.customerFile.updateMany({
            where: { id: { in: dto.fileIds }, clinicId },
            data: { measurementSessionId: id },
          })
        }
      }

      return tx.measurementSession.findFirst({
        where: { id },
        include: SESSION_INCLUDE,
      })
    })
  }

  async deleteSession(id: string, clinicId: string) {
    return prisma.$transaction(async (tx) => {
      // Desvincular arquivos (soft-link apenas)
      await tx.customerFile.updateMany({
        where: { measurementSessionId: id, clinicId },
        data: { measurementSessionId: null },
      })

      // Buscar registros de fichas
      const records = await tx.measurementSheetRecord.findMany({
        where: { sessionId: id },
        select: { id: true },
      })
      const recordIds = records.map((r) => r.id)

      // Deletar valores
      await tx.measurementValue.deleteMany({ where: { sheetRecordId: { in: recordIds } } })
      await tx.measurementTabularValue.deleteMany({ where: { sheetRecordId: { in: recordIds } } })
      await tx.measurementSheetRecord.deleteMany({ where: { sessionId: id } })
      await tx.measurementSession.deleteMany({ where: { id, clinicId } })
    })
  }
}
