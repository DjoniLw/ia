import { prisma } from '../../database/prisma/client'
import type {
  CreateFieldDto,
  CreateSheetDto,
  CreateSubColumnDto,
  ReorderFieldsDto,
  UpdateFieldDto,
  UpdateSheetDto,
  UpdateSubColumnDto,
} from './measurement-sheets.dto'

export class MeasurementSheetsRepository {
  // ─── Fichas ────────────────────────────────────────────────────────────────

  async countActiveSheets(clinicId: string): Promise<number> {
    return prisma.measurementSheet.count({
      where: { clinicId, active: true },
    })
  }

  async listSheets(clinicId: string, activeOnly: boolean) {
    return prisma.measurementSheet.findMany({
      where: { clinicId, ...(activeOnly ? { active: true } : {}) },
      orderBy: { order: 'asc' },
      include: {
        fields: {
          ...(activeOnly ? { where: { active: true } } : {}),
          orderBy: { order: 'asc' },
          include: {
            columns: { orderBy: { order: 'asc' } },
          },
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

  async createSheet(clinicId: string, dto: CreateSheetDto) {
    return prisma.measurementSheet.create({
      data: { clinicId, name: dto.name, order: dto.order ?? 0 },
      include: { fields: true },
    })
  }

  async updateSheet(id: string, clinicId: string, dto: UpdateSheetDto) {
    await prisma.measurementSheet.updateMany({
      where: { id, clinicId },
      data: { ...(dto.name !== undefined && { name: dto.name }), ...(dto.order !== undefined && { order: dto.order }), ...(dto.active !== undefined && { active: dto.active }) },
    })
    return prisma.measurementSheet.findFirst({
      where: { id, clinicId },
      include: { fields: { include: { columns: true } } },
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
      include: { columns: { orderBy: { order: 'asc' } } },
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
        type: dto.type,
        unit: dto.unit ?? null,
        order: dto.order ?? 0,
        active: true,
      },
      include: { columns: true },
    })
  }

  async updateField(id: string, clinicId: string, dto: UpdateFieldDto) {
    await prisma.measurementField.updateMany({
      where: { id, clinicId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.order !== undefined && { order: dto.order }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })
    // Cascata: desativar campo TABULAR cascateia sub-colunas via desativação lógica
    if (dto.active === false) {
      const field = await prisma.measurementField.findFirst({ where: { id, clinicId } })
      if (field?.type === 'TABULAR') {
        // Sub-colunas não têm campo active, apenas são removidas ou mantidas históricamente
        // Não há cascade necessário pois sub-colunas são read-only após inativação do campo
      }
    }
    return prisma.measurementField.findFirst({
      where: { id, clinicId },
      include: { columns: true },
    })
  }

  async fieldHasHistory(id: string): Promise<boolean> {
    const [valuesCount, tabularCount] = await Promise.all([
      prisma.measurementValue.count({ where: { fieldId: id } }),
      prisma.measurementTabularValue.count({ where: { fieldId: id } }),
    ])
    return valuesCount + tabularCount > 0
  }

  async deleteField(id: string, clinicId: string) {
    // CASCADE sub-colunas
    const field = await this.findFieldById(id, clinicId)
    if (field) {
      await prisma.measurementSubColumn.deleteMany({ where: { fieldId: id } })
      await prisma.measurementField.deleteMany({ where: { id, clinicId } })
    }
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

  // ─── Sub-colunas ──────────────────────────────────────────────────────────

  async countSubColumns(fieldId: string): Promise<number> {
    return prisma.measurementSubColumn.count({ where: { fieldId } })
  }

  async findSubColumnById(id: string, fieldId: string) {
    return prisma.measurementSubColumn.findFirst({ where: { id, fieldId } })
  }

  async findSubColumnByName(fieldId: string, name: string) {
    return prisma.measurementSubColumn.findFirst({
      where: { fieldId, name: { equals: name, mode: 'insensitive' } },
    })
  }

  async createSubColumn(fieldId: string, dto: CreateSubColumnDto) {
    return prisma.measurementSubColumn.create({
      data: { fieldId, name: dto.name, unit: dto.unit, order: dto.order ?? 0 },
    })
  }

  async updateSubColumn(id: string, fieldId: string, dto: UpdateSubColumnDto) {
    await prisma.measurementSubColumn.updateMany({
      where: { id, fieldId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.unit !== undefined && { unit: dto.unit }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    })
    return prisma.measurementSubColumn.findFirst({ where: { id, fieldId } })
  }

  async columnHasHistory(id: string): Promise<boolean> {
    const count = await prisma.measurementTabularValue.count({ where: { columnId: id } })
    return count > 0
  }

  async deleteSubColumn(id: string, fieldId: string) {
    await prisma.measurementSubColumn.deleteMany({ where: { id, fieldId } })
  }
}
