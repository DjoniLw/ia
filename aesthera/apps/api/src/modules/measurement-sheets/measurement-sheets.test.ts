import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeasurementSheetsService } from './measurement-sheets.service'
import { MeasurementSheetsRepository } from './measurement-sheets.repository'
import { AppointmentsRepository } from '../appointments/appointments.repository'
import { ValidationError, ConflictError, ForbiddenError } from '../../shared/errors/app-error'
import { CreateSheetDto, UpdateSheetDto } from './measurement-sheets.dto'

vi.mock('./measurement-sheets.repository')
vi.mock('../appointments/appointments.repository')

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
  let appointmentsRepo: AppointmentsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new MeasurementSheetsRepository() as any
    appointmentsRepo = new AppointmentsRepository() as any
    svc = new MeasurementSheetsService()
    ;(svc as any).repo = repo
    ;(svc as any).appointmentsRepo = appointmentsRepo
  })

  // ─── createSheet ───────────────────────────────────────────────────────────

  it('deve criar ficha com nome e retornar 201', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.findSheetByName).mockResolvedValue(null)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet() as any)

    const result = await svc.createSheet(CLINIC_ID, { name: 'Perimetria', type: 'SIMPLE', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1', 'admin')
    expect(result).toBeDefined()
    expect(repo.createSheet).toHaveBeenCalledWith(CLINIC_ID, { name: 'Perimetria', type: 'SIMPLE', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1')
  })

  it('deve retornar 422 MAX_SHEETS_REACHED ao criar com 20 fichas ativas', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(20)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)

    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha', type: 'SIMPLE', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1', 'admin')).rejects.toThrow(ValidationError)
    await expect(svc.createSheet(CLINIC_ID, { name: 'Nova Ficha', type: 'SIMPLE', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1', 'admin')).rejects.toThrow('MAX_SHEETS_REACHED')
  })

  it('deve retornar 409 ao criar ficha com nome duplicado (case-insensitive)', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(true)

    await expect(svc.createSheet(CLINIC_ID, { name: 'PERIMETRIA', type: 'SIMPLE', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1', 'admin')).rejects.toThrow(ConflictError)
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
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ scope: 'SYSTEM' }) as any)
    vi.mocked(repo.sheetHasHistory).mockResolvedValue(true)

    await expect(svc.deleteSheet(SHEET_ID, CLINIC_ID, 'admin-user', 'admin')).rejects.toThrow('HAS_HISTORY')
  })

  it('deve hard-delete sheet sem histórico', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ scope: 'SYSTEM' }) as any)
    vi.mocked(repo.sheetHasHistory).mockResolvedValue(false)
    vi.mocked(repo.deleteSheet).mockResolvedValue(undefined as any)

    await expect(svc.deleteSheet(SHEET_ID, CLINIC_ID, 'admin-user', 'admin')).resolves.toBeUndefined()
    expect(repo.deleteSheet).toHaveBeenCalledWith(SHEET_ID, CLINIC_ID)
  })

  // ─── Cross-tenant ──────────────────────────────────────────────────────────

  it('deve retornar 403 ao tentar modificar ficha de outra clínica', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ clinicId: 'other-clinic' }) as any)

    await expect(svc.updateSheet(SHEET_ID, CLINIC_ID, { name: 'Novo' }, 'user-1', 'admin')).rejects.toThrow(ForbiddenError)
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
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet({ type: 'TABULAR' }) as any)

    const result = await svc.createSheet(CLINIC_ID, { name: 'Avaliação Tabular', type: 'TABULAR', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1', 'admin')
    expect(repo.createSheet).toHaveBeenCalledWith(CLINIC_ID, { name: 'Avaliação Tabular', type: 'TABULAR', category: 'CORPORAL', scope: 'SYSTEM' }, 'user-1')
    expect(result).toBeDefined()
  })

  // ─── updateSheet: reativação ──────────────────────────────────────────────

  it('deve retornar 422 MAX_SHEETS_REACHED ao reativar ficha quando já existem 20 ativas', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ active: false, scope: 'SYSTEM' }) as any)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(20)

    await expect(svc.updateSheet(SHEET_ID, CLINIC_ID, { active: true }, 'user-1', 'admin')).rejects.toThrow('MAX_SHEETS_REACHED')
  })

  it('deve reativar ficha desativada com sucesso quando há menos de 20 ativas', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ active: false, scope: 'SYSTEM' }) as any)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(5)
    vi.mocked(repo.updateSheet).mockResolvedValue(makeSheet({ active: true }) as any)

    const result = await svc.updateSheet(SHEET_ID, CLINIC_ID, { active: true }, 'user-1', 'admin')
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

  // ─── Issue #157: scope/category + autorização granular ───────────────────

  it('[#157] POST scope=CUSTOMER sem customerId → 400 via Zod refine', () => {
    const result = CreateSheetDto.safeParse({ name: 'Ficha Cliente', type: 'SIMPLE', scope: 'CUSTOMER' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.errors[0].path).toContain('customerId')
    }
  })

  it('[#157] POST por professional sem agendamento confirmado → 403', async () => {
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(appointmentsRepo.existsConfirmed).mockResolvedValue(false)

    await expect(
      svc.createSheet(
        CLINIC_ID,
        { name: 'Ficha Cliente', type: 'SIMPLE', category: 'CORPORAL', scope: 'CUSTOMER', customerId: 'customer-1' },
        'professional-1',
        'professional',
      ),
    ).rejects.toThrow('SEM_AGENDAMENTO_CONFIRMADO')
  })

  it('[#157] POST por professional com agendamento confirmed → 201', async () => {
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(appointmentsRepo.existsConfirmed).mockResolvedValue(true)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet({ scope: 'CUSTOMER' }) as any)
    ;(svc as any).db = {
      customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', clinicId: CLINIC_ID }) },
    }

    const result = await svc.createSheet(
      CLINIC_ID,
      { name: 'Ficha Cliente', type: 'SIMPLE', category: 'CORPORAL', scope: 'CUSTOMER', customerId: 'customer-1' },
      'professional-1',
      'professional',
    )
    expect(result).toBeDefined()
  })

  it('[#157] PATCH scope=SYSTEM por staff → 403', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ scope: 'SYSTEM' }) as any)

    await expect(
      svc.updateSheet(SHEET_ID, CLINIC_ID, { name: 'Novo' }, 'staff-1', 'staff'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('[#157] PATCH scope=CUSTOMER pelo criador → 200', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ scope: 'CUSTOMER', createdByUserId: 'user-creator' }) as any)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.updateSheet).mockResolvedValue(makeSheet({ name: 'Novo Nome' }) as any)

    const result = await svc.updateSheet(SHEET_ID, CLINIC_ID, { name: 'Novo Nome' }, 'user-creator', 'staff')
    expect(result).toBeDefined()
  })

  it('[#157] PATCH scope=CUSTOMER por outro usuário não-admin → 403', async () => {
    vi.mocked(repo.findSheetById).mockResolvedValue(makeSheet({ scope: 'CUSTOMER', createdByUserId: 'outro-user' }) as any)

    await expect(
      svc.updateSheet(SHEET_ID, CLINIC_ID, { name: 'Novo' }, 'staff-diferente', 'staff'),
    ).rejects.toThrow(ForbiddenError)
  })

  it('[#157] PATCH enviando campo type → 400 via Zod strict', () => {
    const result = UpdateSheetDto.safeParse({ name: 'Ok', type: 'TABULAR' })
    expect(result.success).toBe(false)
  })

  it('[#157] GET com clinicId de outra clínica → lista vazia', async () => {
    vi.mocked(repo.listSheets).mockResolvedValue([])

    const result = await svc.listSheets('outra-clinica', { includeInactive: false })
    expect(result).toHaveLength(0)
    expect(repo.listSheets).toHaveBeenCalledWith('outra-clinica', true, { scope: undefined, category: undefined })
  })

  it('[#157] POST /templates/:id/copy por staff → deve lançar ForbiddenError (403)', async () => {
    await expect(
      svc.copyTemplate('clinic-id', 'user-staff', 'staff', 'tpl-perimetria')
    ).rejects.toThrow(ForbiddenError)
  })

  it('[#157] POST /templates/:id/copy por admin → cria ficha a partir do template (tpl-perimetria)', async () => {
    const txMock = {
      measurementSheet: {
        create: vi.fn().mockResolvedValue({
          id: 'sheet-new',
          clinicId: CLINIC_ID,
          name: 'Perimetria',
          type: 'SIMPLE',
          category: 'CORPORAL',
          scope: 'SYSTEM',
          active: true,
          order: 0,
          fields: [],
          columns: [],
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'sheet-new',
          clinicId: CLINIC_ID,
          name: 'Perimetria',
          type: 'SIMPLE',
          category: 'CORPORAL',
          scope: 'SYSTEM',
          active: true,
          order: 0,
          fields: [],
          columns: [],
        }),
      },
      measurementField: { createMany: vi.fn().mockResolvedValue({}) },
    }

    const dbMock = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
    }

    ;(svc as any).db = dbMock

    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)

    const result = await svc.copyTemplate(CLINIC_ID, 'user-admin', 'admin', 'tpl-perimetria')

    expect(dbMock.$transaction).toHaveBeenCalledOnce()
    expect(txMock.measurementSheet.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        clinicId: CLINIC_ID,
        name: 'Perimetria',
        category: 'CORPORAL',
        type: 'SIMPLE',
      }),
    }))
    expect(result).toBeDefined()
  })

  it('[#157] Copiar mesmo template duas vezes → sufixo numérico no nome', async () => {
    const txMock = {
      measurementSheet: {
        create: vi.fn().mockResolvedValue({
          id: 'sheet-copy-2',
          clinicId: CLINIC_ID,
          name: 'Perimetria 2',
          type: 'SIMPLE',
          category: 'CORPORAL',
          scope: 'SYSTEM',
          active: true,
          order: 0,
          fields: [],
          columns: [],
        }),
        findFirst: vi.fn().mockResolvedValue({
          id: 'sheet-copy-2',
          clinicId: CLINIC_ID,
          name: 'Perimetria 2',
          type: 'SIMPLE',
          category: 'CORPORAL',
          scope: 'SYSTEM',
          active: true,
          order: 0,
          fields: [],
          columns: [],
        }),
      },
      measurementField: { createMany: vi.fn().mockResolvedValue({}) },
    }

    const dbMock = {
      $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
    }

    ;(svc as any).db = dbMock

    vi.mocked(repo.existsSheetNameInClinic)
      .mockResolvedValueOnce(true)   // 'Perimetria' → já existe
      .mockResolvedValueOnce(false)  // 'Perimetria 2' → disponível
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)

    await svc.copyTemplate(CLINIC_ID, 'user-admin', 'admin', 'tpl-perimetria')

    expect(txMock.measurementSheet.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ name: 'Perimetria 2' }),
    }))
  })

  it('[#157] Migration não-destrutiva: campos novos têm defaults (CORPORAL, SYSTEM, null)', () => {
    // Confirmação estrutural: o DTO aceita ficha sem os novos campos e aplica defaults
    const result = CreateSheetDto.safeParse({ name: 'Sem Categoria', type: 'SIMPLE' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.category).toBe('CORPORAL')
      expect(result.data.scope).toBe('SYSTEM')
      expect(result.data.customerId).toBeUndefined()
    }
  })

  // ─── createSheet: sourceSheetId (deep clone) ──────────────────────────────

  it('[#159] POST com sourceSheetId válido → clona campos e colunas da ficha de origem', async () => {
    const SOURCE_SHEET_ID = 'source-sheet-1'
    const sourceSheet = makeSheet({
      id: SOURCE_SHEET_ID,
      type: 'TABULAR',
      columns: [makeColumn()],
      fields: [makeField({ active: true, isTextual: false, subColumns: [], defaultValue: null })],
    })

    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)

    const txMock = {
      measurementSheet: {
        create: vi.fn().mockResolvedValue({ id: 'new-sheet', clinicId: CLINIC_ID, type: 'TABULAR' }),
        findFirst: vi.fn().mockResolvedValue({ id: 'new-sheet', clinicId: CLINIC_ID, columns: [makeColumn()], fields: [makeField()] }),
      },
      measurementSheetColumn: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
      measurementField: { createMany: vi.fn().mockResolvedValue({ count: 1 }) },
    }

    const dbMock = {
      customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', clinicId: CLINIC_ID }) },
      $transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(txMock)),
    }

    ;(svc as any).db = dbMock
    vi.mocked(repo.findSheetById).mockResolvedValue(sourceSheet as any)

    await svc.createSheet(
      CLINIC_ID,
      {
        name: 'Perimetria (João)',
        type: 'TABULAR',
        category: 'PERSONALIZADA',
        scope: 'CUSTOMER',
        customerId: 'customer-1',
        sourceSheetId: SOURCE_SHEET_ID,
      },
      'staff-1',
      'staff',
    )

    expect(dbMock.$transaction).toHaveBeenCalledOnce()
    expect(txMock.measurementSheetColumn.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ name: makeColumn().name })]),
      }),
    )
    expect(txMock.measurementField.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([expect.objectContaining({ name: makeField().name })]),
      }),
    )
  })

  it('[#159] POST com sourceSheetId de ficha inexistente → 404', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.findSheetById).mockResolvedValue(null)

    const { NotFoundError } = await import('../../shared/errors/app-error')

    ;(svc as any).db = {
      customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', clinicId: CLINIC_ID }) },
    }

    await expect(
      svc.createSheet(
        CLINIC_ID,
        {
          name: 'Cópia',
          type: 'SIMPLE',
          category: 'PERSONALIZADA',
          scope: 'CUSTOMER',
          customerId: 'customer-1',
          sourceSheetId: 'nao-existe',
        },
        'staff-1',
        'staff',
      ),
    ).rejects.toThrow(NotFoundError)
  })

  it('[#159] POST sem sourceSheetId → chama repo.createSheet (sem clone)', async () => {
    vi.mocked(repo.countActiveSheets).mockResolvedValue(0)
    vi.mocked(repo.existsSheetNameInClinic).mockResolvedValue(false)
    vi.mocked(repo.createSheet).mockResolvedValue(makeSheet({ scope: 'CUSTOMER' }) as any)

    ;(svc as any).db = {
      customer: { findFirst: vi.fn().mockResolvedValue({ id: 'customer-1', clinicId: CLINIC_ID }) },
    }

    await svc.createSheet(
      CLINIC_ID,
      { name: 'Em Branco', type: 'SIMPLE', category: 'PERSONALIZADA', scope: 'CUSTOMER', customerId: 'customer-1' },
      'staff-1',
      'staff',
    )

    expect(repo.createSheet).toHaveBeenCalledOnce()
  })
})

