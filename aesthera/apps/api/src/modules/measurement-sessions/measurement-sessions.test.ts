import { describe, it, expect, vi, beforeEach } from 'vitest'
import { MeasurementSessionsService } from './measurement-sessions.service'
import { MeasurementSessionsRepository } from './measurement-sessions.repository'
import { ForbiddenError } from '../../shared/errors/app-error'

vi.mock('./measurement-sessions.repository')

const CLINIC_ID = 'clinic-1'
const CUSTOMER_ID = 'customer-1'
const SESSION_ID = 'session-1'
const USER_ID = 'user-1'
const OTHER_USER_ID = 'user-2'

const MOCK_LOGGER = {
  warn: vi.fn(),
  info: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
} as any

function makeSession(overrides = {}) {
  return {
    id: SESSION_ID,
    clinicId: CLINIC_ID,
    customerId: CUSTOMER_ID,
    recordedAt: new Date('2026-03-25'),
    notes: null,
    createdById: USER_ID,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

function makeCreateDto(overrides = {}) {
  return {
    customerId: CUSTOMER_ID,
    recordedAt: '2026-03-25',
    sheetRecords: [
      {
        sheetId: 'sheet-1',
        values: [{ fieldId: 'field-1', value: 65 }],
        tabularValues: [],
      },
    ],
    fileIds: [],
    ...overrides,
  }
}

describe('MeasurementSessionsService', () => {
  let svc: MeasurementSessionsService
  let repo: MeasurementSessionsRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new MeasurementSessionsRepository() as any
    svc = new MeasurementSessionsService()
    ;(svc as any).repo = repo
  })

  // ─── createSession ─────────────────────────────────────────────────────────

  it('deve criar sessão com campos SIMPLE e retornar a sessão criada', async () => {
    vi.mocked(repo.findCustomerInClinic).mockResolvedValue({ id: CUSTOMER_ID } as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateColumnsOwnership).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue(makeSession() as any)

    const result = await svc.createSession(CLINIC_ID, USER_ID, makeCreateDto() as any, MOCK_LOGGER)
    expect(result).toBeDefined()
  })

  it('deve criar sessão com campos TABULAR (com sub-colunas)', async () => {
    const dto = makeCreateDto({
      sheetRecords: [
        {
          sheetId: 'sheet-1',
          values: [],
          tabularValues: [
            { fieldId: 'field-tab', columnId: 'col-1', value: 12.5 },
            { fieldId: 'field-tab', columnId: 'col-2', value: 8.3 },
          ],
        },
      ],
    })

    vi.mocked(repo.findCustomerInClinic).mockResolvedValue({ id: CUSTOMER_ID } as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateColumnsOwnership).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue(makeSession() as any)

    const result = await svc.createSession(CLINIC_ID, USER_ID, dto as any, MOCK_LOGGER)
    expect(result).toBeDefined()
  })

  it('deve retornar 400 EMPTY_SESSION se nenhum valor preenchido', async () => {
    const dto = makeCreateDto({
      sheetRecords: [{ sheetId: 'sheet-1', values: [], tabularValues: [] }],
    })

    vi.mocked(repo.findCustomerInClinic).mockResolvedValue({ id: CUSTOMER_ID } as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateColumnsOwnership).mockResolvedValue(true)

    await expect(svc.createSession(CLINIC_ID, USER_ID, dto as any, MOCK_LOGGER)).rejects.toThrow('EMPTY_SESSION')
  })

  it('deve logar warning para recordedAt retroativo > 7 dias', async () => {
    const oldDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    const dto = makeCreateDto({
      recordedAt: oldDate.toISOString().slice(0, 10),
    })

    vi.mocked(repo.findCustomerInClinic).mockResolvedValue({ id: CUSTOMER_ID } as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateColumnsOwnership).mockResolvedValue(true)
    vi.mocked(repo.createSession).mockResolvedValue(makeSession() as any)

    await svc.createSession(CLINIC_ID, USER_ID, dto as any, MOCK_LOGGER)
    expect(MOCK_LOGGER.warn).toHaveBeenCalledWith(
      expect.objectContaining({ clinicId: CLINIC_ID, customerId: CUSTOMER_ID }),
      'Retroactive measurement session',
    )
  })

  // ─── updateSession ─────────────────────────────────────────────────────────

  it('admin deve conseguir editar qualquer sessão da clínica', async () => {
    vi.mocked(repo.findSessionById).mockResolvedValue(makeSession({ createdById: OTHER_USER_ID }) as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.updateSession).mockResolvedValue(makeSession() as any)

    const dto = { notes: 'Atualizado' }
    const result = await svc.updateSession(SESSION_ID, CLINIC_ID, USER_ID, 'admin', dto as any, MOCK_LOGGER)
    expect(result).toBeDefined()
  })

  it('professional deve conseguir editar apenas sessão própria (createdById)', async () => {
    vi.mocked(repo.findSessionById).mockResolvedValue(makeSession({ createdById: USER_ID }) as any)
    vi.mocked(repo.validateSheetsOwnership).mockResolvedValue(true)
    vi.mocked(repo.validateFieldsOwnership).mockResolvedValue(true)
    vi.mocked(repo.updateSession).mockResolvedValue(makeSession() as any)

    const result = await svc.updateSession(SESSION_ID, CLINIC_ID, USER_ID, 'professional', { notes: 'Ok' } as any, MOCK_LOGGER)
    expect(result).toBeDefined()
  })

  it('professional deve receber 403 ao tentar editar sessão de outro usuário', async () => {
    vi.mocked(repo.findSessionById).mockResolvedValue(makeSession({ createdById: OTHER_USER_ID }) as any)

    await expect(
      svc.updateSession(SESSION_ID, CLINIC_ID, USER_ID, 'professional', { notes: 'Tentativa' } as any, MOCK_LOGGER),
    ).rejects.toThrow(ForbiddenError)
  })

  // ─── deleteSession ─────────────────────────────────────────────────────────

  it('deve deletar sessão existente', async () => {
    vi.mocked(repo.findSessionById).mockResolvedValue(makeSession() as any)
    vi.mocked(repo.deleteSession).mockResolvedValue(undefined as any)

    await expect(svc.deleteSession(SESSION_ID, CLINIC_ID)).resolves.toBeUndefined()
  })

  // ─── Cross-tenant ──────────────────────────────────────────────────────────

  it('deve retornar 403 ao tentar ler sessões de cliente de outra clínica', async () => {
    vi.mocked(repo.findCustomerInClinic).mockResolvedValue(null)

    await expect(
      svc.listSessions(CLINIC_ID, { customerId: CUSTOMER_ID, page: 1, limit: 20 }),
    ).rejects.toThrow(ForbiddenError)
  })
})
