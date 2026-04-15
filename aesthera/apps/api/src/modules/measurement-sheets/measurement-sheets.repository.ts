import { prisma } from '../../database/prisma/client'
import { MeasurementCategory, MeasurementInputType, MeasurementScope } from '@prisma/client'
import type {
  CreateFieldDto,
  CreateSheetColumnDto,
  CreateSheetDto,
  ReorderFieldsDto,
  ReorderSheetColumnsDto,
  ReorderSheetsDto,
  UpdateFieldDto,
  UpdateSheetColumnDto,
  UpdateSheetDto,
} from './measurement-sheets.dto'

export class MeasurementSheetsRepository {
  // ─── Fichas ────────────────────────────────────────────────────────────────

  async countActiveSheets(clinicId: string): Promise<number> {
    return prisma.measurementSheet.count({
      where: { clinicId, active: true },
    })
  }

  async listSheets(clinicId: string, activeOnly: boolean, filters?: { scope?: string; category?: string }) {
    return prisma.measurementSheet.findMany({
      where: {
        clinicId,
        ...(activeOnly ? { active: true } : {}),
        ...(filters?.scope ? { scope: filters.scope as MeasurementScope } : {}),
        ...(filters?.category ? { category: filters.category as MeasurementCategory } : {}),
      },
      orderBy: { order: 'asc' },
      include: {
        columns: { orderBy: { order: 'asc' } },
        fields: {
          ...(activeOnly ? { where: { active: true } } : {}),
          orderBy: { order: 'asc' },
        },
      },
    })
  }

  async findSheetById(id: string, clinicId: string) {
    return prisma.measurementSheet.findFirst({ where: { id, clinicId } })
  }

  async findSheetByName(clinicId: string, name: string) {
    return prisma.measurementSheet.findFirst({
      where: { clinicId, name: { equals: name, mode: 'insensitive' } },
    })
  }

  async createSheet(clinicId: string, dto: CreateSheetDto, createdByUserId?: string) {
    return prisma.measurementSheet.create({
      data: {
        clinicId,
        name: dto.name,
        type: dto.type,
        order: dto.order ?? 0,
        category: dto.category as MeasurementCategory ?? 'CORPORAL',
        scope: dto.scope as MeasurementScope ?? 'SYSTEM',
        customerId: dto.customerId ?? null,
        createdByUserId: createdByUserId ?? null,
      },
      include: { columns: true, fields: true },
    })
  }

  async updateSheet(id: string, clinicId: string, dto: UpdateSheetDto) {
    await prisma.measurementSheet.updateMany({
      where: { id, clinicId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.active !== undefined && { active: dto.active }),
        ...(dto.category !== undefined && { category: dto.category as MeasurementCategory }),
      },
    })
    return prisma.measurementSheet.findFirst({
      where: { id, clinicId },
      include: { columns: { orderBy: { order: 'asc' } }, fields: { orderBy: { order: 'asc' } } },
    })
  }

  async sheetHasHistory(id: string): Promise<boolean> {
    const count = await prisma.measurementSheetRecord.count({ where: { sheetId: id } })
    return count > 0
  }

  async deleteSheet(id: string, clinicId: string) {
    await prisma.measurementSheet.deleteMany({ where: { id, clinicId } })
  }

  // ─── Campos ────────────────────────────────────────────────────────────────

  async countActiveFields(sheetId: string): Promise<number> {
    return prisma.measurementField.count({
      where: { sheetId, active: true },
    })
  }

  async listFields(sheetId: string) {
    return prisma.measurementField.findMany({
      where: { sheetId },
      orderBy: { order: 'asc' },
    })
  }

  async findFieldById(id: string, clinicId: string) {
    return prisma.measurementField.findFirst({ where: { id, clinicId } })
  }

  async findFieldByName(sheetId: string, name: string) {
    return prisma.measurementField.findFirst({
      where: { sheetId, name: { equals: name, mode: 'insensitive' } },
    })
  }

  async createField(sheetId: string, clinicId: string, dto: CreateFieldDto) {
    return prisma.measurementField.create({
      data: {
        sheetId,
        clinicId,
        name: dto.name,
        inputType: dto.inputType as MeasurementInputType,
        unit: dto.unit ?? null,
        isTextual: dto.isTextual ?? false,
        defaultValue: dto.defaultValue ?? null,
        subColumns: dto.subColumns ?? [],
        order: dto.order ?? 0,
        active: true,
      },
    })
  }

  async updateField(id: string, clinicId: string, dto: UpdateFieldDto) {
    await prisma.measurementField.updateMany({
      where: { id, clinicId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.inputType !== undefined && { inputType: dto.inputType as MeasurementInputType }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.isTextual !== undefined && { isTextual: dto.isTextual }),
        ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue ?? null }),
        ...(dto.subColumns !== undefined && { subColumns: dto.subColumns }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })
    return prisma.measurementField.findFirst({ where: { id, clinicId } })
  }

  async fieldHasHistory(id: string): Promise<boolean> {
    const [valuesCount, tabularCount] = await Promise.all([
      prisma.measurementValue.count({ where: { fieldId: id } }),
      prisma.measurementTabularValue.count({ where: { fieldId: id } }),
    ])
    return valuesCount + tabularCount > 0
  }

  async deleteField(id: string, clinicId: string) {
    await prisma.measurementField.deleteMany({ where: { id, clinicId } })
  }

  async reorderFields(sheetId: string, clinicId: string, items: ReorderFieldsDto) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.measurementField.updateMany({
          where: { id: item.id, sheetId, clinicId },
          data: { order: item.order },
        }),
      ),
    )
  }

  async validateFieldsOwnedBySheet(fieldIds: string[], sheetId: string, clinicId: string): Promise<boolean> {
    const count = await prisma.measurementField.count({
      where: { id: { in: fieldIds }, sheetId, clinicId },
    })
    return count === fieldIds.length
  }

  // ─── Colunas da ficha (fichas TABULAR) ────────────────────────────────────

  async countSheetColumns(sheetId: string): Promise<number> {
    return prisma.measurementSheetColumn.count({ where: { sheetId } })
  }

  async listSheetColumns(sheetId: string) {
    return prisma.measurementSheetColumn.findMany({
      where: { sheetId },
      orderBy: { order: 'asc' },
    })
  }

  async findSheetColumnById(id: string, sheetId: string) {
    return prisma.measurementSheetColumn.findFirst({ where: { id, sheetId } })
  }

  async findSheetColumnByName(sheetId: string, name: string) {
    return prisma.measurementSheetColumn.findFirst({
      where: { sheetId, name: { equals: name, mode: 'insensitive' } },
    })
  }

  async createSheetColumn(sheetId: string, dto: CreateSheetColumnDto) {
    return prisma.measurementSheetColumn.create({
      data: {
        sheetId,
        name: dto.name,
        inputType: dto.inputType as MeasurementInputType,
        unit: dto.unit ?? null,
        isTextual: dto.isTextual ?? false,
        defaultValue: dto.defaultValue ?? null,
        order: dto.order ?? 0,
      },
    })
  }

  async updateSheetColumn(id: string, sheetId: string, dto: UpdateSheetColumnDto) {
    await prisma.measurementSheetColumn.updateMany({
      where: { id, sheetId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.inputType !== undefined && { inputType: dto.inputType as MeasurementInputType }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.isTextual !== undefined && { isTextual: dto.isTextual }),
        ...(dto.defaultValue !== undefined && { defaultValue: dto.defaultValue }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    })
    return prisma.measurementSheetColumn.findFirst({ where: { id, sheetId } })
  }

  async sheetColumnHasHistory(id: string): Promise<boolean> {
    const count = await prisma.measurementTabularValue.count({ where: { sheetColumnId: id } })
    return count > 0
  }

  async deleteSheetColumn(id: string, sheetId: string) {
    await prisma.measurementSheetColumn.deleteMany({ where: { id, sheetId } })
  }

  async reorderSheetColumns(sheetId: string, items: ReorderSheetColumnsDto) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.measurementSheetColumn.updateMany({
          where: { id: item.id, sheetId },
          data: { order: item.order },
        }),
      ),
    )
  }

  // ─── Fichas ───────────────────────────────────────────────────────────────

  async reorderSheets(clinicId: string, items: ReorderSheetsDto) {
    return prisma.$transaction(
      items.map((item) =>
        prisma.measurementSheet.updateMany({
          where: { id: item.id, clinicId },
          data: { order: item.order },
        }),
      ),
    )
  }

  async validateSheetsOwnedByClinic(sheetIds: string[], clinicId: string): Promise<boolean> {
    const count = await prisma.measurementSheet.count({
      where: { id: { in: sheetIds }, clinicId },
    })
    return count === sheetIds.length
  }

  async findSheetByNameAndScope(clinicId: string, name: string, scope: string) {
    return prisma.measurementSheet.findFirst({
      where: {
        clinicId,
        scope: scope as MeasurementScope,
        name: { equals: name, mode: 'insensitive' },
      },
    })
  }

  async existsSheetNameInClinic(clinicId: string, name: string, scope: string, excludeId?: string): Promise<boolean> {
    const count = await prisma.measurementSheet.count({
      where: {
        clinicId,
        scope: scope as MeasurementScope,
        name: { equals: name, mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
    })
    return count > 0
  }
}
