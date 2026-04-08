import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByToken: vi.fn(),
  markExpired: vi.fn(),
  cancel: vi.fn(),
  resend: vi.fn(),
  submitSignature: vi.fn(),
  requestCorrection: vi.fn(),
}))

const mockNotificationsService = vi.hoisted(() => ({
  sendWhatsApp: vi.fn().mockResolvedValue(undefined),
  sendEmail: vi.fn().mockResolvedValue(undefined),
}))

const mockEventBus = vi.hoisted(() => ({
  publish: vi.fn(),
}))

const mockAppConfig = vi.hoisted(() => ({
  frontendUrl: 'http://localhost:3000',
}))

const mockPrismaTx = vi.hoisted(() => ({
  anamnesisRequest: { findFirst: vi.fn() },
  clinicalRecord: { findFirst: vi.fn(), create: vi.fn() },
}))

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn((cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => cb(mockPrismaTx)),
}))

vi.mock('./anamnesis.repository', () => ({
  AnamnesisRepository: vi.fn(function AnamnesisRepository() {
    return mockRepo
  }),
}))

vi.mock('../notifications/notifications.service', () => ({
  NotificationsService: vi.fn(function NotificationsService() {
    return mockNotificationsService
  }),
}))

vi.mock('../../shared/events/event-bus', () => ({
  eventBus: mockEventBus,
}))

vi.mock('../../config/app.config', () => ({
  appConfig: mockAppConfig,
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: mockPrisma,
}))

import { AnamnesisService, handleAnamnesisSignedEvent } from './anamnesis.service'
import { ConflictError, GoneError, NotFoundError } from '../../shared/errors/app-error'

// ── Constantes ────────────────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-uuid-1'
const USER_ID = 'user-uuid-1'
const CUSTOMER_ID = 'customer-uuid-1'
const REQUEST_ID = 'request-uuid-1'
const SIGN_TOKEN = 'abc123token'

const FUTURE_DATE = new Date(Date.now() + 72 * 60 * 60 * 1000)
const PAST_DATE = new Date(Date.now() - 1 * 60 * 60 * 1000)

const BASE_PUBLIC_REQUEST = {
  id: REQUEST_ID,
  clinicId: CLINIC_ID,
  customerId: CUSTOMER_ID,
  signToken: SIGN_TOKEN,
  status: 'pending',
  expiresAt: FUTURE_DATE,
  mode: 'blank',
  groupName: 'Anamnese Facial',
  questionsSnapshot: [],
  staffAnswers: null,
  clinic: { id: CLINIC_ID, name: 'Clínica Teste', slug: 'clinica-teste' },
  customer: { id: CUSTOMER_ID, name: 'João Silva', phone: '+5511999999999', email: 'joao@test.com' },
}

// ── create ────────────────────────────────────────────────────────────────────

describe('AnamnesisService.create()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve criar solicitação com token e expiração de 72h', async () => {
    const fakeRequest = {
      id: REQUEST_ID,
      createdBy: { id: USER_ID, name: 'Staff' },
      customer: { id: CUSTOMER_ID, name: 'João', phone: null, email: null },
    }
    mockRepo.create.mockResolvedValue(fakeRequest)

    const result = await service.create(CLINIC_ID, USER_ID, {
      customerId: CUSTOMER_ID,
      mode: 'blank',
      groupId: 'group-1',
      groupName: 'Anamnese Facial',
      questionsSnapshot: [{ id: '1', label: 'Alergias?', type: 'text', required: true }],
    })

    expect(mockRepo.create).toHaveBeenCalledWith(
      CLINIC_ID,
      USER_ID,
      expect.objectContaining({
        customerId: CUSTOMER_ID,
        mode: 'blank',
        groupId: 'group-1',
        signToken: expect.any(String),
        expiresAt: expect.any(Date),
      }),
    )
    expect(result).toBe(fakeRequest)
  })

  it('deve enviar WhatsApp quando channel=whatsapp e customer tem phone', async () => {
    const fakeRequest = {
      id: REQUEST_ID,
      createdBy: { id: USER_ID, name: 'Staff' },
      customer: { id: CUSTOMER_ID, name: 'João', phone: '+5511999999999', email: null },
      signToken: SIGN_TOKEN,
      groupName: 'Anamnese Facial',
      expiresAt: FUTURE_DATE,
    }
    mockRepo.create.mockResolvedValue(fakeRequest)

    await service.create(CLINIC_ID, USER_ID, {
      customerId: CUSTOMER_ID,
      mode: 'blank',
      groupId: 'group-1',
      groupName: 'Anamnese Facial',
      questionsSnapshot: [{ id: '1', label: 'Alergias?', type: 'text', required: true }],
      channel: 'whatsapp',
    })

    // Aguardar microtasks assíncronas
    await vi.waitFor(() => expect(mockNotificationsService.sendWhatsApp).toHaveBeenCalled())
    expect(mockNotificationsService.sendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({
        clinicId: CLINIC_ID,
        phone: '+5511999999999',
        event: 'anamnesis.requested',
      }),
    )
  })
})

// ── getPublicInfo ─────────────────────────────────────────────────────────────

describe('AnamnesisService.getPublicInfo()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve retornar dados do formulário para token válido', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)

    const result = await service.getPublicInfo(SIGN_TOKEN)

    expect(result).toMatchObject({
      id: REQUEST_ID,
      clinicName: 'Clínica Teste',
      customerName: 'João Silva',
      mode: 'blank',
      groupName: 'Anamnese Facial',
    })
  })

  it('deve lançar NotFoundError quando token não existe', async () => {
    mockRepo.findByToken.mockResolvedValue(null)

    await expect(service.getPublicInfo('token-invalido')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deve lançar GoneError (410) quando expiresAt < now e status=pending — lazy check', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, expiresAt: PAST_DATE })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
    expect(mockRepo.markExpired).toHaveBeenCalledWith(CLINIC_ID, REQUEST_ID)
  })

  it('deve lançar GoneError quando status=expired', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'expired' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
  })

  it('deve lançar ConflictError (409) quando status=signed', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'signed' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lançar GoneError quando status=cancelled', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'cancelled' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
  })
})

// ── submit ────────────────────────────────────────────────────────────────────

describe('AnamnesisService.submit()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  const VALID_SIGNATURE = 'data:image/png;base64,abc123'
  const META = { ipAddress: '192.168.0.1', userAgent: 'Mozilla/5.0' }
  const DTO = { clientAnswers: { q1: 'Nenhuma' }, signature: VALID_SIGNATURE, consentGiven: true as const }

  it('deve assinar anamnese com sucesso e publicar evento anamnesis.signed', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)
    mockRepo.submitSignature.mockResolvedValue(1)

    const result = await service.submit(SIGN_TOKEN, DTO, META)

    expect(result).toEqual({ success: true })
    expect(mockRepo.submitSignature).toHaveBeenCalledWith(
      SIGN_TOKEN,
      expect.objectContaining({
        clientAnswers: { q1: 'Nenhuma' },
        signatureHash: expect.any(String),
        consentText: expect.stringContaining('João Silva'),
      }),
    )
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: 'anamnesis.signed',
        clinicId: CLINIC_ID,
        payload: expect.objectContaining({ anamnesisRequestId: REQUEST_ID }),
      }),
    )
  })

  it('deve lançar GoneError se expiresAt < now antes de submeter', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, expiresAt: PAST_DATE })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(GoneError)
    expect(mockRepo.submitSignature).not.toHaveBeenCalled()
  })

  it('deve lançar ConflictError se status não é pending/correction_requested', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'signed' })

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lançar ConflictError em race condition — updateMany retorna 0', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)
    mockRepo.submitSignature.mockResolvedValue(0) // race condition

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(ConflictError)
  })
})

// ── resend ────────────────────────────────────────────────────────────────────

describe('AnamnesisService.resend()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve gerar novo token e prazo ao reenviar', async () => {
    const existing = {
      id: REQUEST_ID,
      clinicId: CLINIC_ID,
      status: 'expired',
      customer: { id: CUSTOMER_ID, name: 'João', phone: null, email: null },
    }
    mockRepo.findById.mockResolvedValue(existing)
    mockRepo.resend.mockResolvedValue({ ...existing, status: 'pending' })

    await service.resend(CLINIC_ID, REQUEST_ID, {})

    expect(mockRepo.resend).toHaveBeenCalledWith(
      CLINIC_ID,
      REQUEST_ID,
      expect.any(String),  // novo token
      expect.any(Date),    // novo expiresAt
    )
  })

  it('deve lançar ConflictError ao tentar reenviar anamnese já assinada', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, clinicId: CLINIC_ID, status: 'signed' })

    await expect(service.resend(CLINIC_ID, REQUEST_ID, {})).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lançar ConflictError ao tentar reenviar anamnese cancelada', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, clinicId: CLINIC_ID, status: 'cancelled' })

    await expect(service.resend(CLINIC_ID, REQUEST_ID, {})).rejects.toBeInstanceOf(ConflictError)
  })
})

// ── handleAnamnesisSignedEvent ────────────────────────────────────────────────

describe('handleAnamnesisSignedEvent()', () => {
  const PAYLOAD = {
    anamnesisRequestId: REQUEST_ID,
    clinicId: CLINIC_ID,
    customerId: CUSTOMER_ID,
    groupName: 'Anamnese Facial',
    signedAt: new Date().toISOString(),
  }

  const STORED_REQUEST = {
    id: REQUEST_ID,
    clinicId: CLINIC_ID,
    groupName: 'Anamnese Facial',
    questionsSnapshot: [
      { id: 'q1', text: 'Tem alergias?', type: 'yesno', required: true },
      { id: 'q2', text: 'Observações', type: 'text', required: false },
    ],
    staffAnswers: null,
    clientAnswers: { q1: 'Sim', q2: 'Nenhuma' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => cb(mockPrismaTx),
    )
  })

  it('deve criar ClinicalRecord com conteúdo no formato { groupName, entries }', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(STORED_REQUEST)
    mockPrismaTx.clinicalRecord.findFirst.mockResolvedValue(null)
    mockPrismaTx.clinicalRecord.create.mockResolvedValue({ id: 'cr-1' })

    await handleAnamnesisSignedEvent(PAYLOAD)

    expect(mockPrismaTx.clinicalRecord.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          clinicId: CLINIC_ID,
          customerId: CUSTOMER_ID,
          type: 'anamnesis',
          title: 'Anamnese — Anamnese Facial',
          content: JSON.stringify({
            groupName: 'Anamnese Facial',
            entries: [
              { question: 'Tem alergias?', answer: 'Sim', type: 'yesno' },
              { question: 'Observações', answer: 'Nenhuma', type: 'text' },
            ],
          }),
        }),
      }),
    )
  })

  it('não deve criar ClinicalRecord duplicado se já existe (idempotência)', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(STORED_REQUEST)
    mockPrismaTx.clinicalRecord.findFirst.mockResolvedValue({ id: 'cr-existing' })

    await handleAnamnesisSignedEvent(PAYLOAD)

    expect(mockPrismaTx.clinicalRecord.create).not.toHaveBeenCalled()
  })

  it('não deve criar ClinicalRecord quando AnamnesisRequest não é encontrado', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(null)

    await handleAnamnesisSignedEvent(PAYLOAD)

    expect(mockPrismaTx.clinicalRecord.create).not.toHaveBeenCalled()
  })
})
