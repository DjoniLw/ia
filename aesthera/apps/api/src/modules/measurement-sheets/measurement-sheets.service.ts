import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import {
  MAX_ACTIVE_FIELDS,
  MAX_ACTIVE_SHEETS,
  MAX_SUB_COLUMNS,
  type CreateFieldDto,
  type CreateSheetDto,
  type CreateSubColumnDto,
  type ListSheetsQuery,
  type ReorderFieldsDto,
  type UpdateFieldDto,
  type UpdateSheetDto,
  type UpdateSubColumnDto,
} from './measurement-sheets.dto'
import { MeasurementSheetsRepository } from './measurement-sheets.repository'

export class MeasurementSheetsService {
  private repo = new MeasurementSheetsRepository()

  // ─── Fichas ────────────────────────────────────────────────────────────────

  async listSheets(clinicId: string, q: ListSheetsQuery) {
    return this.repo.listSheets(clinicId, !q.includeInactive)
  }

  async createSheet(clinicId: string, dto: CreateSheetDto) {
    // Limite de fichas ativas
    const count = await this.repo.countActiveSheets(clinicId)
    if (count >= MAX_ACTIVE_SHEETS) {
      throw new ValidationError('MAX_SHEETS_REACHED')
    }

    // Nome único por clínica (case-insensitive)
    const existing = await this.repo.findSheetByName(clinicId, dto.name)
    if (existing) {
      throw new ConflictError('Nome de ficha já existe nesta clínica')
    }

    return this.repo.createSheet(clinicId, dto)
  }

  async updateSheet(id: string, clinicId: string, dto: UpdateSheetDto) {
    const sheet = await this.repo.findSheetById(id, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Reativar: verificar limite
    if (dto.active === true && !sheet.active) {
      const count = await this.repo.countActiveSheets(clinicId)
      if (count >= MAX_ACTIVE_SHEETS) {
        throw new ValidationError('MAX_SHEETS_REACHED')
      }
    }

    // Nome único por clínica (case-insensitive), se alterando o nome
    if (dto.name && dto.name.toLowerCase() !== sheet.name.toLowerCase()) {
      const existing = await this.repo.findSheetByName(clinicId, dto.name)
      if (existing) {
        throw new ConflictError('Nome de ficha já existe nesta clínica')
      }
    }

    return this.repo.updateSheet(id, clinicId, dto)
  }

  async deleteSheet(id: string, clinicId: string) {
    const sheet = await this.repo.findSheetById(id, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Se houver histórico: apenas desativar (soft-disable)
    const hasHistory = await this.repo.sheetHasHistory(id)
    if (hasHistory) {
      throw new ValidationError('HAS_HISTORY')
    }

    await this.repo.deleteSheet(id, clinicId)
  }

  // ─── Campos ────────────────────────────────────────────────────────────────

  async listFields(sheetId: string, clinicId: string) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    return this.repo.listFields(sheetId)
  }

  async createField(sheetId: string, clinicId: string, dto: CreateFieldDto) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Validação de tipo
    if (dto.type === 'SIMPLE' && !dto.unit) {
      throw new ValidationError('Unidade é obrigatória para campos do tipo SIMPLES')
    }
    if (dto.type === 'TABULAR' && dto.unit) {
      throw new ValidationError('Campos TABULARES não devem ter unidade — a unidade fica em cada sub-coluna')
    }

    // Limite de campos
    const count = await this.repo.countActiveFields(sheetId)
    if (count >= MAX_ACTIVE_FIELDS) {
      throw new ValidationError('MAX_FIELDS_REACHED')
    }

    // Nome único na ficha
    const existing = await this.repo.findFieldByName(sheetId, dto.name)
    if (existing) {
      throw new ConflictError('Nome de campo já existe nesta ficha')
    }

    return this.repo.createField(sheetId, clinicId, dto)
  }

  async updateField(sheetId: string, fieldId: string, clinicId: string, dto: UpdateFieldDto) {
    const field = await this.repo.findFieldById(fieldId, clinicId)
    if (!field) throw new NotFoundError('MeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    if (dto.name && dto.name.toLowerCase() !== field.name.toLowerCase()) {
      const existing = await this.repo.findFieldByName(sheetId, dto.name)
      if (existing) {
        throw new ConflictError('Nome de campo já existe nesta ficha')
      }
    }

    return this.repo.updateField(fieldId, clinicId, dto)
  }

  async deleteField(sheetId: string, fieldId: string, clinicId: string) {
    const field = await this.repo.findFieldById(fieldId, clinicId)
    if (!field) throw new NotFoundError('MeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const hasHistory = await this.repo.fieldHasHistory(fieldId)
    if (hasHistory) {
      throw new ValidationError('HAS_HISTORY')
    }

    await this.repo.deleteField(fieldId, clinicId)
  }

  async reorderFields(sheetId: string, clinicId: string, items: ReorderFieldsDto) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const fieldIds = items.map((i) => i.id)
    const allOwned = await this.repo.validateFieldsOwnedBySheet(fieldIds, sheetId, clinicId)
    if (!allOwned) {
      throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    await this.repo.reorderFields(sheetId, clinicId, items)
    return this.repo.listFields(sheetId)
  }

  // ─── Sub-colunas ──────────────────────────────────────────────────────────

  async createSubColumn(sheetId: string, fieldId: string, clinicId: string, dto: CreateSubColumnDto) {
    const field = await this.repo.findFieldById(fieldId, clinicId)
    if (!field) throw new NotFoundError('MeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    if (field.type !== 'TABULAR') {
      throw new ValidationError('Sub-colunas são permitidas apenas em campos do tipo TABULAR')
    }

    const count = await this.repo.countSubColumns(fieldId)
    if (count >= MAX_SUB_COLUMNS) {
      throw new ValidationError('MAX_COLUMNS_REACHED')
    }

    const existing = await this.repo.findSubColumnByName(fieldId, dto.name)
    if (existing) {
      throw new ConflictError('Nome de sub-coluna já existe neste campo')
    }

    return this.repo.createSubColumn(fieldId, dto)
  }

  async updateSubColumn(sheetId: string, fieldId: string, colId: string, clinicId: string, dto: UpdateSubColumnDto) {
    const field = await this.repo.findFieldById(fieldId, clinicId)
    if (!field) throw new NotFoundError('MeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const col = await this.repo.findSubColumnById(colId, fieldId)
    if (!col) throw new NotFoundError('MeasurementSubColumn')

    return this.repo.updateSubColumn(colId, fieldId, dto)
  }

  async deleteSubColumn(sheetId: string, fieldId: string, colId: string, clinicId: string) {
    const field = await this.repo.findFieldById(fieldId, clinicId)
    if (!field) throw new NotFoundError('MeasurementField')
    if (field.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const col = await this.repo.findSubColumnById(colId, fieldId)
    if (!col) throw new NotFoundError('MeasurementSubColumn')

    const hasHistory = await this.repo.columnHasHistory(colId)
    if (hasHistory) {
      throw new ValidationError('HAS_HISTORY')
    }

    await this.repo.deleteSubColumn(colId, fieldId)
  }
}
