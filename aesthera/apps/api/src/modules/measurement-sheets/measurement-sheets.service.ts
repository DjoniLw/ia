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
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { MEASUREMENT_TEMPLATES } from './measurement-templates'
import { prisma as defaultPrisma } from '../../database/prisma/client'
import type { PrismaClient } from '@prisma/client'
import { MeasurementCategory, MeasurementScope, MeasurementSheetType } from '@prisma/client'

export class MeasurementSheetsService {
  private repo: MeasurementSheetsRepository
  private appointmentsRepo: AppointmentsRepository
  private db: PrismaClient

  constructor(db: PrismaClient = defaultPrisma) {
    this.db = db
    this.repo = new MeasurementSheetsRepository()
    this.appointmentsRepo = new AppointmentsRepository()
  }

  // ─── Fichas ────────────────────────────────────────────────────────────────

  async listSheets(clinicId: string, q: ListSheetsQuery) {
    return this.repo.listSheets(clinicId, !q.includeInactive, { scope: q.scope, category: q.category })
  }

  async createSheet(clinicId: string, dto: CreateSheetDto, userId?: string, role?: string) {
    const scope = dto.scope ?? 'SYSTEM'

    // Autorização por role/scope
    if (scope === 'SYSTEM') {
      if (role !== 'admin') throw new ForbiddenError('Apenas administradores podem criar fichas do sistema')
    } else {
      // scope === 'CUSTOMER'
      if (role === 'professional') {
        const hasAppointment = await this.appointmentsRepo.existsConfirmed({
          clinicId,
          professionalId: userId!,
          customerId: dto.customerId!,
          statusIn: ['confirmed', 'in_progress', 'completed'],
        })
        if (!hasAppointment) throw new ForbiddenError('SEM_AGENDAMENTO_CONFIRMADO')
      } else if (role !== 'admin' && role !== 'staff') {
        throw new ForbiddenError('Permissão insuficiente')
      }
    }

    // Limite de fichas ativas
    const count = await this.repo.countActiveSheets(clinicId)
    if (count >= MAX_ACTIVE_SHEETS) {
      throw new ValidationError('MAX_SHEETS_REACHED')
    }

    // Validar que customerId pertence à clinicId (cross-tenant)
    if (scope === 'CUSTOMER' && dto.customerId) {
      const customer = await this.db.customer.findFirst({ where: { id: dto.customerId, clinicId } })
      if (!customer) throw new ForbiddenError('CROSS_TENANT_VIOLATION')
    }

    // Nome único por clínica e scope (case-insensitive)
    const nameExists = await this.repo.existsSheetNameInClinic(clinicId, dto.name, scope)
    if (nameExists) {
      throw new ConflictError('Nome de ficha já existe nesta clínica')
    }

    return this.repo.createSheet(clinicId, dto, userId)
  }
  async updateSheet(id: string, clinicId: string, dto: UpdateSheetDto, userId?: string, role?: string) {
    const sheet = await this.repo.findSheetById(id, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Autorização por scope da ficha
    const sheetScope = (sheet as unknown as { scope: string }).scope ?? 'SYSTEM'
    if (sheetScope === 'SYSTEM') {
      if (role !== 'admin') throw new ForbiddenError('Apenas administradores podem editar fichas do sistema')
    } else {
      // scope === 'CUSTOMER'
      const isCreator = (sheet as unknown as { createdByUserId: string | null }).createdByUserId === userId
      if (role !== 'admin' && !isCreator) {
        throw new ForbiddenError('Apenas o criador ou administrador pode editar esta ficha')
      }
    }

    // Reativar: verificar limite
    if (dto.active === true && !sheet.active) {
      const count = await this.repo.countActiveSheets(clinicId)
      if (count >= MAX_ACTIVE_SHEETS) {
        throw new ValidationError('MAX_SHEETS_REACHED')
      }
    }

    // Nome único por clínica (case-insensitive), se alterando o nome
    if (dto.name && dto.name.toLowerCase() !== sheet.name.toLowerCase()) {
      const nameExists = await this.repo.existsSheetNameInClinic(clinicId, dto.name, sheetScope, id)
      if (nameExists) {
        throw new ConflictError('Nome de ficha já existe nesta clínica')
      }
    }

    return this.repo.updateSheet(id, clinicId, dto)
  }

  async deleteSheet(id: string, clinicId: string, userId?: string, role?: string) {
    const sheet = await this.repo.findSheetById(id, clinicId)
    if (!sheet) throw new NotFoundError('MeasurementSheet')
    if (sheet.clinicId !== clinicId) throw new ForbiddenError('CROSS_TENANT_VIOLATION')

    // Autorização por scope da ficha
    const sheetScope = (sheet as unknown as { scope: string }).scope ?? 'SYSTEM'
    if (sheetScope === 'SYSTEM') {
      if (role !== 'admin') throw new ForbiddenError('Apenas administradores podem excluir fichas do sistema')
    } else {
      const isCreator = (sheet as unknown as { createdByUserId: string | null }).createdByUserId === userId
      if (role !== 'admin' && !isCreator) {
        throw new ForbiddenError('Apenas o criador ou administrador pode excluir esta ficha')
      }
    }

    // Se houver histórico: apenas desativar (soft-disable)
    const hasHistory = await this.repo.sheetHasHistory(id)
    if (hasHistory) {
      throw new ValidationError('HAS_HISTORY')
    }

    await this.repo.deleteSheet(id, clinicId)
  }

  // ─── Templates ─────────────────────────────────────────────────────────────

  listTemplates() {
    return MEASUREMENT_TEMPLATES
  }

  async copyTemplate(clinicId: string, userId: string, role: string, templateId: string, customName?: string | null) {
    if (role !== 'admin') throw new ForbiddenError('Apenas administradores podem copiar templates')

    const template = MEASUREMENT_TEMPLATES.find((t) => t.id === templateId)
    if (!template) throw new NotFoundError('MeasurementTemplate')

    const count = await this.repo.countActiveSheets(clinicId)
    if (count >= MAX_ACTIVE_SHEETS) throw new ValidationError('MAX_SHEETS_REACHED')

    // Resolver nome único com sufixo numérico se necessário
    let baseName = customName ?? template.name
    let finalName = baseName
    let suffix = 2
    while (await this.repo.existsSheetNameInClinic(clinicId, finalName, 'SYSTEM')) {
      finalName = `${baseName} ${suffix}`
      suffix++
    }

    if (template.type === MeasurementSheetType.SIMPLE) {
      return this.db.$transaction(async (tx) => {
        const sheet = await tx.measurementSheet.create({
          data: {
            clinicId,
            name: finalName,
            type: MeasurementSheetType.SIMPLE,
            category: template.category as MeasurementCategory,
            scope: MeasurementScope.SYSTEM,
            createdByUserId: userId,
            order: 0,
          },
        })
        const fields = (template as { fields: string[] }).fields
        await tx.measurementField.createMany({
          data: fields.map((fieldName, idx) => ({
            sheetId: sheet.id,
            clinicId,
            name: fieldName,
            inputType: 'INPUT',
            order: idx,
            active: true,
          })),
        })
        return tx.measurementSheet.findFirst({
          where: { id: sheet.id },
          include: { fields: { orderBy: { order: 'asc' } }, columns: true },
        })
      })
    } else {
      return this.db.$transaction(async (tx) => {
        const sheet = await tx.measurementSheet.create({
          data: {
            clinicId,
            name: finalName,
            type: MeasurementSheetType.TABULAR,
            category: template.category as MeasurementCategory,
            scope: MeasurementScope.SYSTEM,
            createdByUserId: userId,
            order: 0,
          },
        })
        const tpl = template as { rows: string[]; columns: string[] }
        await tx.measurementField.createMany({
          data: tpl.rows.map((rowName, idx) => ({
            sheetId: sheet.id,
            clinicId,
            name: rowName,
            inputType: 'INPUT',
            order: idx,
            active: true,
          })),
        })
        await tx.measurementSheetColumn.createMany({
          data: tpl.columns.map((colName, idx) => ({
            sheetId: sheet.id,
            name: colName,
            inputType: 'INPUT',
            order: idx,
          })),
        })
        return tx.measurementSheet.findFirst({
          where: { id: sheet.id },
          include: { fields: { orderBy: { order: 'asc' } }, columns: { orderBy: { order: 'asc' } } },
        })
      })
    }
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

    const targetInputType = dto.inputType ?? field.inputType
    if (targetInputType === 'CHECK' && dto.unit !== undefined) {
      throw new ValidationError('Campos de marcação não devem ter unidade')
    }

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
