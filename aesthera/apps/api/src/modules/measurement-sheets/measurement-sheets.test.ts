import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeasurementSheetsService } from './measurement-sheets.service'
import { MeasurementSheetsRepository } from './measurement-sheets.repository'
import { ValidationError, ConflictError, NotFoundError, ForbiddenError } from '../../shared/errors/app-error'

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
    type: 'SIMPLE',
    unit: 'kg',
    order: 0,
    active: true,
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

    const result = await svc.createSheet(CLINIC_ID, { name: 'Perimetria' })
    expect(result).toBeDefined()
    expect(repo.createSheet).toHaveBeenCalledWith(CLINIC_ID, { name: 'Perimetria' })
  })

  it('deve retornar 422 MAX_SHEETS_REACHED ao criar com 20 fichas ativas', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(20)

    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha' })).rejects.toThrow(ValidationError)
    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha' })).rejects.toThrow('MAX_SHEETS_REACHED')
  })

  it('deve retornar 409 ao criar ficha com nome duplicado (case-insensitive)', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.findSheetByName).mockResolvedValue(makeSheet() as any)

    await expect(svc.createSheet(CLINIC_ID, { name: 'PERIMETRIA' })).rejects.toThrow(ConflictError)
  })

  // ─── createField ───────────────────────────────────────────────────────────

  it('deve criar campo SIMPLE com unidade', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(0)
    vi.mocked(repo.findFieldByName).mockResolvedValue(null)
    vi.mocked(repo.createField).mockResolvedValue(makeField() as any)

    const result = await svc.createField(SHEET_ID, CLINIC_ID, { name: 'Peso', type: 'SIMPLE', unit: 'kg' })
    expect(result).toBeDefined()
  })

  it('deve criar campo TABULAR sem unidade', async () => {
    const tabularField = makeField({ type: 'TABULAR', unit: null })
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(0)
    vi.mocked(repo.findFieldByName).mockResolvedValue(null)
    vi.mocked(repo.createField).mockResolvedValue({ ...tabularField, columns: [] } as any)

    const result = await svc.createField(SHEET_ID, CLINIC_ID, { name: 'Dobras', type: 'TABULAR' })
    expect(result).toBeDefined()
  })

  it('deve retornar erro ao criar campo SIMPLE sem unidade', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)

    await expect(
      svc.createField(SHEET_ID, CLINIC_ID, { name: 'Peso', type: 'SIMPLE' }),
    ).rejects.toThrow(ValidationError)
  })

  it('deve retornar 422 MAX_FIELDS_REACHED ao atingir 30 campos ativos', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.countActiveFields).mockResolvedValue(30)

    await expect(
      svc.createField(SHEET_ID, CLINIC_ID, { name: 'Campo Extra', type: 'SIMPLE', unit: 'cm' }),
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

  // ─── reorderFields ─────────────────────────────────────────────────────────

  it('deve retornar erro 403 se um fieldId não pertence à sheet', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet() as any)
    vi.mocked(repo.validateFieldsOwnedBySheet).mockResolvedValue(false)

    await expect(
      svc.reorderFields(SHEET_ID, CLINIC_ID, [{ id: 'foreign-field', order: 0 }]),
    ).rejects.toThrow(ForbiddenError)
  })
})
