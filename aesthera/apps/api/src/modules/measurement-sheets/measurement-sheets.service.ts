import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../shared/errors/app-error'
import {
  MAX_ACTIVE_FIELDS,
  MAX_ACTIVE_SHEETS,
  MAX_SHEET_COLUMNS,
  type CreateFieldDto,
  type CreateSheetColumnDto,
  type CreateSheetDto,
  type ListSheetsQuery,
  type ReorderFieldsDto,
  type ReorderSheetColumnsDto,
  type ReorderSheetsDto,
  type UpdateFieldDto,
  type UpdateSheetColumnDto,
  type UpdateSheetDto,
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

    // Em fichas TABULAR, a unidade é definida na coluna (não no campo)
    if (sheet.type === 'TABULAR' && dto.unit) {
      throw new ValidationError('Campos de ficha tabular não devem ter unidade — a unidade é definida em cada coluna')
    }

    // Em fichas SIMPLE com INPUT, unidade é recomendada mas não obrigatória
    // Em fichas SIMPLE com CHECK, não faz sentido ter unidade
    if (dto.inputType === 'CHECK' && dto.unit) {
      throw new ValidationError('Campos de marcação não devem ter unidade')
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

  async deleteField(_sheetId: string, fieldId: string, clinicId: string) {
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

  async reorderSheets(clinicId: string, dto: ReorderSheetsDto) {
    const sheetIds = dto.map((d) => d.id)
    const allOwned = await this.repo.validateSheetsOwnedByClinic(sheetIds, clinicId)
    if (!allOwned) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    await this.repo.reorderSheets(clinicId, dto)
    return this.repo.listSheets(clinicId, false)
  }

  // ─── Colunas (fichas TABULAR) ──────────────────────────────────────────────

  async listSheetColumns(sheetId: string, clinicId: string) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    return this.repo.listSheetColumns(sheetId)
  }

  async createSheetColumn(sheetId: string, clinicId: string, dto: CreateSheetColumnDto) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    if (sheet.type !== 'TABULAR') throw new ValidationError('Colunas são permitidas apenas em fichas do tipo TABULAR')

    const count = await this.repo.countSheetColumns(sheetId)
    if (count >= MAX_SHEET_COLUMNS) throw new ValidationError('MAX_COLUMNS_REACHED')

    const existing = await this.repo.findSheetColumnByName(sheetId, dto.name)
    if (existing) throw new ConflictError('Nome de coluna já existe nesta ficha')

    return this.repo.createSheetColumn(sheetId, dto)
  }

  async updateSheetColumn(sheetId: string, colId: string, clinicId: string, dto: UpdateSheetColumnDto) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const col = await this.repo.findSheetColumnById(colId, sheetId)
    if (!col) throw new NotFoundError('MeasurementSheetColumn')

    if (dto.name && dto.name.toLowerCase() !== col.name.toLowerCase()) {
      const existing = await this.repo.findSheetColumnByName(sheetId, dto.name)
      if (existing) throw new ConflictError('Nome de coluna já existe nesta ficha')
    }

    return this.repo.updateSheetColumn(colId, sheetId, dto)
  }

  async deleteSheetColumn(sheetId: string, colId: string, clinicId: string) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    const col = await this.repo.findSheetColumnById(colId, sheetId)
    if (!col) throw new NotFoundError('MeasurementSheetColumn')

    const hasHistory = await this.repo.sheetColumnHasHistory(colId)
    if (hasHistory) throw new ValidationError('HAS_HISTORY')

    await this.repo.deleteSheetColumn(colId, sheetId)
  }

  async reorderSheetColumns(sheetId: string, clinicId: string, items: ReorderSheetColumnsDto) {
    const sheet = await this.repo.findSheetById(sheetId, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    await this.repo.reorderSheetColumns(sheetId, items)
    return this.repo.listSheetColumns(sheetId)
  }
}
