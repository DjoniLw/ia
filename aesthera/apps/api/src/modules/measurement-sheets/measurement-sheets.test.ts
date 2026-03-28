import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeasurementSheetsService } from './measurement-sheets.service'
import { MeasurementSheetsRepository } from './measurement-sheets.repository'
import { ValidationError, ConflictError, ForbiddenError } from '../../shared/errors/app-error'

vi.mock('./measurement-sheets.repository')

const CLINIC_ID = 'clinic-1'
const SHEET_ID = 'sheet-1'
const FIELD_ID = 'field-1'
const COL_ID = 'col-1'

function makeSheet(overrides = {}) {
  return {
    id: SHEET_ID,
    clinicId: CLINIC_ID,
    name: 'Perimetria',
    type: 'SIMPLE',
    active: true,
    order: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeField(overrides = {}) {
  return {
    id: FIELD_ID,
    clinicId: CLINIC_ID,
    sheetId: SHEET_ID,
    name: 'Peso',
    inputType: 'INPUT',
    unit: 'kg',
    order: 0,
    active: true,
    ...overrides,
  }
}

function makeColumn(overrides = {}) {
  return {
    id: COL_ID,
    sheetId: SHEET_ID,
    name: 'D-Esquerda',
    inputType: 'INPUT',
    unit: 'mm',
    order: 0,
    isTextual: false,
    defaultValue: null,
    ...overrides,
  }
}

describe('MeasurementSheetsService', () => {
  let svc: MeasurementSheetsService
  let repo: MeasurementSheetsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new MeasurementSheetsRepository() as any
    svc = new MeasurementSheetsService()
    ;(svc as any).repo = repo
  })

  // ─── createSheet ───────────────────────────────────────────────────────────

  it('deve criar ficha com nome e retornar 201', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.findSheetByName).mockResolvedValue(null)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet() as any)

    const result = await svc.createSheet(CLINIC_ID, { name: 'Perimetria', type: 'SIMPLE' })
    expect(result).toBeDefined()
    expect(repo.createSheet).toHaveBeenCalledWith(CLINIC_ID, { name: 'Perimetria', type: 'SIMPLE' })
  })

  it('deve retornar 422 MAX_SHEETS_REACHED ao criar com 20 fichas ativas', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(20)

    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha', type: 'SIMPLE' })).rejects.toThrow(ValidationError)
    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha', type: 'SIMPLE' })).rejects.toThrow('MAX_SHEETS_REACHED')
  })

  it('deve retornar 409 ao criar ficha com nome duplicado (case-insensitive)', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.findSheetByName).mockResolvedValue(makeSheet() as any)

    await expect(svc.createSheet(CLINIC_ID, { name: 'PERIMETRIA', type: 'SIMPLE' })).rejects.toThrow(ConflictError)
  })

  // ─── createField ───────────────────────────────────────────────────────────

  it('deve criar campo SIMPLE com unidade', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(0)
    vi.mocked(repo.findFieldByName).mockResolvedValue(null)
    vi.mocked(repo.createField).mockResolvedValue(makeField() as any)

    const result = await svc.createField(SHEET_ID, CLINIC_ID, { name: 'Peso', inputType: 'INPUT', unit: 'kg', isTextual: false, subColumns: [] })
    expect(result).toBeDefined()
  })

  it('deve criar campo CHECK sem unidade', async () => {
    const checkField = makeField({ inputType: 'CHECK', unit: null })
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(0)
    vi.mocked(repo.findFieldByName).mockResolvedValue(null)
    vi.mocked(repo.createField).mockResolvedValue(checkField as any)

    const result = await svc.createField(SHEET_ID, CLINIC_ID, { name: 'Marcacao', inputType: 'CHECK', isTextual: false, subColumns: [] })
    expect(result).toBeDefined()
  })

  it('deve rejeitar campo CHECK com unidade', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)

    await expect(
      svc.createField(SHEET_ID, CLINIC_ID, { name: 'Marcacao', inputType: 'CHECK', unit: 'cm', isTextual: false, subColumns: [] }),
    ).rejects.toThrow(ValidationError)
  })

  it('deve retornar 422 MAX_FIELDS_REACHED ao atingir 30 campos ativos', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(30)

    await expect(
      svc.createField(SHEET_ID, CLINIC_ID, { name: 'Campo Extra', inputType: 'INPUT', unit: 'cm', isTextual: false, subColumns: [] }),
    ).rejects.toThrow('MAX_FIELDS_REACHED')
  })

  // ─── deleteSheet ───────────────────────────────────────────────────────────

  it('deve retornar 422 HAS_HISTORY se existir MeasurementSheetRecord', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.sheetHasHistory).mockResolvedValue(true)

    await expect(svc.deleteSheet(SHEET_ID, CLINIC_ID)).rejects.toThrow('HAS_HISTORY')
  })

  it('deve hard-delete sheet sem histórico', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.sheetHasHistory).mockResolvedValue(false)
    vi.mocked(repo.deleteSheet).mockResolvedValue(undefined as any)

    await expect(svc.deleteSheet(SHEET_ID, CLINIC_ID)).resolves.toBeUndefined()
    expect(repo.deleteSheet).toHaveBeenCalledWith(SHEET_ID, CLINIC_ID)
  })

  // ─── Cross-tenant ──────────────────────────────────────────────────────────

  it('deve retornar 403 ao tentar modificar ficha de outra clínica', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ clinicId: 'other-clinic' }) as any)

    await expect(svc.updateSheet(SHEET_ID, CLINIC_ID, { name: 'Novo' })).rejects.toThrow(ForbiddenError)
  })

  // ─── reorderSheets ────────────────────────────────────────────────────────

  it('deve retornar 403 ao reordenar fichas de outra clínica', async () => {
    vi.mocked(repo.validateSheetsOwnedByClinic).mockResolvedValue(false)

    await expect(
      svc.reorderSheets(CLINIC_ID, [{ id: 'foreign-sheet', order: 0 }]),
    ).rejects.toThrow(ForbiddenError)
  })

  it('deve reordenar fichas e retornar lista atualizada', async () => {
    vi.mocked(repo.validateSheetsOwnedByClinic).mockResolvedValue(true)
    vi.mocked(repo.reorderSheets).mockResolvedValue(undefined as any)
    vi.mocked(repo.listSheets).mockResolvedValue([makeSheet()] as any)

    const result = await svc.reorderSheets(CLINIC_ID, [{ id: SHEET_ID, order: 0 }])
    expect(repo.reorderSheets).toHaveBeenCalledWith(CLINIC_ID, [{ id: SHEET_ID, order: 0 }])
    expect(result).toHaveLength(1)
  })

  // ─── reorderFields ─────────────────────────────────────────────────────────

  it('deve retornar erro 403 se um fieldId não pertence à sheet', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.validateFieldsOwnedBySheet).mockResolvedValue(false)

    await expect(
      svc.reorderFields(SHEET_ID, CLINIC_ID, [{ id: 'foreign-field', order: 0 }]),
    ).rejects.toThrow(ForbiddenError)
  })

  // ─── createSheet: tipo TABULAR ────────────────────────────────────────────

  it('deve criar ficha do tipo TABULAR e repassar type correto ao repositório', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.findSheetByName).mockResolvedValue(null)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)

    const result = await svc.createSheet(CLINIC_ID, { name: 'Avaliação Tabular', type: 'TABULAR' })
    expect(repo.createSheet).toHaveBeenCalledWith(CLINIC_ID, { name: 'Avaliação Tabular', type: 'TABULAR' })
    expect(result).toBeDefined()
  })

  // ─── updateSheet: reativação ──────────────────────────────────────────────

  it('deve retornar 422 MAX_SHEETS_REACHED ao reativar ficha quando já existem 20 ativas', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ active: false }) as any)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(20)

    await expect(svc.updateSheet(SHEET_ID, CLINIC_ID, { active: true })).rejects.toThrow('MAX_SHEETS_REACHED')
  })

  it('deve reativar ficha desativada com sucesso quando há menos de 20 ativas', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ active: false }) as any)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(5)
    vi.mocked(repo.updateSheet).mockResolvedValue(makeSheet({ active: true }) as any)

    const result = await svc.updateSheet(SHEET_ID, CLINIC_ID, { active: true })
    expect(result).toBeDefined()
    expect(repo.updateSheet).toHaveBeenCalledWith(SHEET_ID, CLINIC_ID, { active: true })
  })

  // ─── createField: ficha TABULAR com unidade ───────────────────────────────

  it('deve retornar 422 ao criar campo com unidade em ficha do tipo TABULAR', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)

    await expect(
      svc.createField(SHEET_ID, CLINIC_ID, { name: 'Colesterol', inputType: 'INPUT', unit: 'mg/dL', isTextual: false, subColumns: [] }),
    ).rejects.toThrow(ValidationError)
  })

  // ─── deleteField ──────────────────────────────────────────────────────────

  it('deve retornar 422 HAS_HISTORY ao deletar campo com histórico de medições', async () => {
    vi.mocked(repo.findFieldById).mockResolvedValue(makeField() as any)
    vi.mocked(repo.fieldHasHistory).mockResolvedValue(true)

    await expect(svc.deleteField(SHEET_ID, FIELD_ID, CLINIC_ID)).rejects.toThrow('HAS_HISTORY')
  })

  it('deve excluir definitivamente campo sem histórico de medições', async () => {
    vi.mocked(repo.findFieldById).mockResolvedValue(makeField() as any)
    vi.mocked(repo.fieldHasHistory).mockResolvedValue(false)
    vi.mocked(repo.deleteField).mockResolvedValue(undefined as any)

    await expect(svc.deleteField(SHEET_ID, FIELD_ID, CLINIC_ID)).resolves.toBeUndefined()
    expect(repo.deleteField).toHaveBeenCalledWith(FIELD_ID, CLINIC_ID)
  })

  it('deve retornar 403 ao tentar deletar campo de outra clínica', async () => {
    vi.mocked(repo.findFieldById).mockResolvedValue(makeField({ clinicId: 'other-clinic' }) as any)

    await expect(svc.deleteField(SHEET_ID, FIELD_ID, CLINIC_ID)).rejects.toThrow(ForbiddenError)
  })

  // ─── createSheetColumn ────────────────────────────────────────────────────

  it('deve retornar 422 ao criar coluna em ficha do tipo SIMPLE', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ type: 'SIMPLE' }) as any)

    await expect(
      svc.createSheetColumn(SHEET_ID, CLINIC_ID, { name: 'Coluna A', inputType: 'INPUT', isTextual: false }),
    ).rejects.toThrow(ValidationError)
  })

  it('deve retornar 422 MAX_COLUMNS_REACHED ao atingir 10 colunas em ficha TABULAR', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)
    vi.mocked(repo.countSheetColumns).mockResolvedValue(10)

    await expect(
      svc.createSheetColumn(SHEET_ID, CLINIC_ID, { name: 'Coluna Extra', inputType: 'INPUT', isTextual: false }),
    ).rejects.toThrow('MAX_COLUMNS_REACHED')
  })

  it('deve retornar 403 ao criar coluna em ficha de outra clínica', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ clinicId: 'other-clinic' }) as any)

    await expect(
      svc.createSheetColumn(SHEET_ID, CLINIC_ID, { name: 'Coluna A', inputType: 'INPUT', isTextual: false }),
    ).rejects.toThrow(ForbiddenError)
  })

  // ─── deleteSheetColumn ────────────────────────────────────────────────────

  it('deve retornar 422 HAS_HISTORY ao deletar coluna com histórico de valores tabulares', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)
    vi.mocked(repo.findSheetColumnById).mockResolvedValue(makeColumn() as any)
    vi.mocked(repo.sheetColumnHasHistory).mockResolvedValue(true)

    await expect(svc.deleteSheetColumn(SHEET_ID, COL_ID, CLINIC_ID)).rejects.toThrow('HAS_HISTORY')
  })

  it('deve excluir definitivamente coluna sem histórico de valores tabulares', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)
    vi.mocked(repo.findSheetColumnById).mockResolvedValue(makeColumn() as any)
    vi.mocked(repo.sheetColumnHasHistory).mockResolvedValue(false)
    vi.mocked(repo.deleteSheetColumn).mockResolvedValue(undefined as any)

    await expect(svc.deleteSheetColumn(SHEET_ID, COL_ID, CLINIC_ID)).resolves.toBeUndefined()
    expect(repo.deleteSheetColumn).toHaveBeenCalledWith(COL_ID, SHEET_ID)
  })

  it('deve retornar 403 ao tentar deletar coluna de ficha de outra clínica', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ clinicId: 'other-clinic' }) as any)

    await expect(svc.deleteSheetColumn(SHEET_ID, COL_ID, CLINIC_ID)).rejects.toThrow(ForbiddenError)
  })
})
