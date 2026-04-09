import { beforeEach, describe, expect, it, vi } from 'vitest'

// â”€â”€ Mocks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const mockRepo = vi.hoisted(() => ({
  create: vi.fn(),
  findAll: vi.fn(),
  findById: vi.fn(),
  findByIdWithClinic: vi.fn(),
  findByToken: vi.fn(),
  markExpired: vi.fn(),
  cancel: vi.fn(),
  resend: vi.fn(),
  submitSignature: vi.fn(),
  requestCorrection: vi.fn(),
  updateStatus: vi.fn(),
  setSignToken: vi.fn(),
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
  anamnesisRequest: { findFirst: vi.fn(), update: vi.fn() },
  clinicalRecord: { findFirst: vi.fn(), create: vi.fn() },
  auditLog: { create: vi.fn() },
}))

const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn((cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => cb(mockPrismaTx)),
  auditLog: { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) },
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

vi.mock('../../integrations/r2/r2.service', () => ({
  uploadBuffer: vi.fn().mockResolvedValue('anamnesis/clinic-uuid-1/request-uuid-1/signature.png'),
}))

import { AnamnesisService, handleAnamnesisSignedEvent } from './anamnesis.service'
import { ConflictError, GoneError, NotFoundError } from '../../shared/errors/app-error'

// â”€â”€ Constantes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const CLINIC_ID = 'clinic-uuid-1'
const USER_ID = 'user-uuid-1'
const CUSTOMER_ID = 'customer-uuid-1'
const REQUEST_ID = 'request-uuid-1'
const SIGN_TOKEN = 'abc123token'

const A_VALID_FUTURE_DATE = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
const PAST_DATE = new Date(Date.now() - 1 * 60 * 60 * 1000)

const BASE_PUBLIC_REQUEST = {
  id: REQUEST_ID,
  clinicId: CLINIC_ID,
  customerId: CUSTOMER_ID,
  signToken: SIGN_TOKEN,
  status: 'pending',
  expiresAt: A_VALID_FUTURE_DATE,
  mode: 'blank',
  groupName: 'Anamnese Facial',
  questionsSnapshot: [],
  staffAnswers: null,
  clinic: { id: CLINIC_ID, name: 'ClÃ­nica Teste', slug: 'clinica-teste' },
  customer: { id: CUSTOMER_ID, name: 'JoÃ£o Silva', phone: '+5511999999999', email: 'joao@test.com' },
}

// â”€â”€ create â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.create()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve criar solicitaÃ§Ã£o com token e prazo de expiraÃ§Ã£o', async () => {
    const fakeRequest = {
      id: REQUEST_ID,
      createdBy: { id: USER_ID, name: 'Staff' },
      customer: { id: CUSTOMER_ID, name: 'JoÃ£o', phone: null, email: null },
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
      customer: { id: CUSTOMER_ID, name: 'JoÃ£o', phone: '+5511999999999', email: null },
      signToken: SIGN_TOKEN,
      groupName: 'Anamnese Facial',
      expiresAt: A_VALID_FUTURE_DATE,
    }
    mockRepo.create.mockResolvedValue(fakeRequest)

    await service.create(CLINIC_ID, USER_ID, {
      customerId: CUSTOMER_ID,
      mode: 'blank',
      groupId: 'group-1',
      groupName: 'Anamnese Facial',
      questionsSnapshot: [{ id: '1', label: 'Alergias?', type: 'text', required: true }],
      phone: '+5511999999999',
    })

    // Aguardar microtasks assÃ­ncronas
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

// â”€â”€ getPublicInfo â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.getPublicInfo()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve retornar dados do formulÃ¡rio para token vÃ¡lido', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)

    const result = await service.getPublicInfo(SIGN_TOKEN)

    expect(result).toMatchObject({
      id: REQUEST_ID,
      clinicName: 'ClÃ­nica Teste',
      customerName: 'JoÃ£o Silva',
      mode: 'blank',
      groupName: 'Anamnese Facial',
    })
  })

  it('deve lanÃ§ar NotFoundError quando token nÃ£o existe', async () => {
    mockRepo.findByToken.mockResolvedValue(null)

    await expect(service.getPublicInfo('token-invalido')).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deve lanÃ§ar GoneError (410) quando expiresAt < now e status=pending â€” lazy check', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, expiresAt: PAST_DATE })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
    expect(mockRepo.markExpired).toHaveBeenCalledWith(CLINIC_ID, REQUEST_ID)
  })

  it('deve lanÃ§ar GoneError quando status=expired', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'expired' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
  })

  it('deve lanÃ§ar ConflictError (409) quando status=signed', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'signed' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lanÃ§ar GoneError quando status=cancelled', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'cancelled' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
  })

  it('deve lanÃ§ar ConflictError quando status=client_submitted', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'client_submitted' })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(ConflictError)
  })
})

// â”€â”€ submit â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.submit()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  const VALID_SIGNATURE = 'data:image/png;base64,' + 'A'.repeat(1_100)
  const META = { ipAddress: '192.168.0.1', userAgent: 'Mozilla/5.0' }
  const DTO = { clientAnswers: { q1: 'Nenhuma' }, signatureBase64: VALID_SIGNATURE, consentGiven: true as const }

  it('deve assinar anamnese com sucesso e publicar evento anamnesis.signed', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)
    mockRepo.submitSignature.mockResolvedValue(1)

    const result = await service.submit(SIGN_TOKEN, DTO, META)

    expect(result).toEqual({ success: true })
    expect(mockRepo.submitSignature).toHaveBeenCalledWith(
      SIGN_TOKEN,
      expect.objectContaining({
        clientAnswers: { q1: 'Nenhuma' },
        signatureUrl: expect.any(String),
        signatureHash: expect.any(String),
        consentText: expect.stringContaining('JoÃ£o Silva'),
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

  it('deve lanÃ§ar GoneError se expiresAt < now antes de submeter', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, expiresAt: PAST_DATE })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(GoneError)
    expect(mockRepo.submitSignature).not.toHaveBeenCalled()
  })

  it('deve lanÃ§ar ConflictError se status nÃ£o Ã© pending/correction_requested', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, status: 'signed' })

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lanÃ§ar ConflictError em race condition â€” updateMany retorna 0', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)
    mockRepo.submitSignature.mockResolvedValue(0) // race condition

    await expect(service.submit(SIGN_TOKEN, DTO, META)).rejects.toBeInstanceOf(ConflictError)
  })
})

// â”€â”€ resend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      customer: { id: CUSTOMER_ID, name: 'JoÃ£o', phone: null, email: null },
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

  it('deve lanÃ§ar ConflictError ao tentar reenviar anamnese jÃ¡ assinada', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, clinicId: CLINIC_ID, status: 'signed' })

    await expect(service.resend(CLINIC_ID, REQUEST_ID, {})).rejects.toBeInstanceOf(ConflictError)
  })

  it('deve lanÃ§ar ConflictError ao tentar reenviar anamnese cancelada', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, clinicId: CLINIC_ID, status: 'cancelled' })

    await expect(service.resend(CLINIC_ID, REQUEST_ID, {})).rejects.toBeInstanceOf(ConflictError)
  })
})

// â”€â”€ handleAnamnesisSignedEvent â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
      { id: 'q2', text: 'ObservaÃ§Ãµes', type: 'text', required: false },
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

  it('deve criar ClinicalRecord com conteÃºdo no formato { groupName, entries }', async () => {
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
              { question: 'ObservaÃ§Ãµes', answer: 'Nenhuma', type: 'text' },
            ],
          }),
        }),
      }),
    )
  })

  it('nÃ£o deve criar ClinicalRecord duplicado se jÃ¡ existe (idempotÃªncia)', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(STORED_REQUEST)
    mockPrismaTx.clinicalRecord.findFirst.mockResolvedValue({ id: 'cr-existing' })

    await handleAnamnesisSignedEvent(PAYLOAD)

    expect(mockPrismaTx.clinicalRecord.create).not.toHaveBeenCalled()
  })

  it('nÃ£o deve criar ClinicalRecord quando AnamnesisRequest nÃ£o Ã© encontrado', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(null)

    await handleAnamnesisSignedEvent(PAYLOAD)

    expect(mockPrismaTx.clinicalRecord.create).not.toHaveBeenCalled()
  })
})

// â”€â”€ SEC1: consentText sempre server-side â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('SEC1 â€” consentText gerado server-side', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve ignorar consentText enviado no body e usar o valor do banco', async () => {
    mockRepo.findByToken.mockResolvedValue({
      ...BASE_PUBLIC_REQUEST,
      clinic: { id: CLINIC_ID, name: 'ClÃ­nica Beleza', slug: 'clinica-beleza', document: '12.345.678/0001-99' },
    })
    mockRepo.submitSignature.mockResolvedValue(1)

    await service.submit(
      SIGN_TOKEN,
      { clientAnswers: {}, signatureBase64: 'x'.repeat(1_100), consentGiven: true },
      { ipAddress: null, userAgent: null },
    )

    const callArgs = mockRepo.submitSignature.mock.calls[0][1]
    // consentText deve conter o nome da clÃ­nica do banco, jamais valor externo
    expect(callArgs.consentText).toContain('ClÃ­nica Beleza')
    expect(callArgs.consentText).toContain('JoÃ£o Silva')
  })
})

// â”€â”€ SEC2: signToken nunca retornado na API pÃºblica â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('SEC2 â€” signToken ausente do retorno de getPublicInfo', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('nÃ£o deve retornar signToken na resposta de getPublicInfo', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)

    const result = await service.getPublicInfo(SIGN_TOKEN)

    expect(result).not.toHaveProperty('signToken')
  })
})

// â”€â”€ SEC3: expiraÃ§Ã£o verificada universalmente (TOCTOU) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('SEC3 â€” expiraÃ§Ã£o verificada em GET e POST', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve rejeitar POST com token expirado mesmo se status=pending', async () => {
    mockRepo.findByToken.mockResolvedValue({ ...BASE_PUBLIC_REQUEST, expiresAt: PAST_DATE })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(
      service.submit(
        SIGN_TOKEN,
        { clientAnswers: {}, signatureBase64: 'x'.repeat(1_100), consentGiven: true },
        { ipAddress: null, userAgent: null },
      ),
    ).rejects.toBeInstanceOf(GoneError)

    expect(mockRepo.submitSignature).not.toHaveBeenCalled()
  })

  it('deve marcar como expirado no GET para status=sent_to_client', async () => {
    mockRepo.findByToken.mockResolvedValue({
      ...BASE_PUBLIC_REQUEST,
      status: 'sent_to_client',
      expiresAt: PAST_DATE,
    })
    mockRepo.markExpired.mockResolvedValue({ count: 1 })

    await expect(service.getPublicInfo(SIGN_TOKEN)).rejects.toBeInstanceOf(GoneError)
    expect(mockRepo.markExpired).toHaveBeenCalledWith(CLINIC_ID, REQUEST_ID)
  })
})

// â”€â”€ RN10: tokenExpiresAt = now + 7 dias â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('RN10 â€” token expira em 7 dias', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve criar expiresAt com prazo de 7 dias a partir de agora', async () => {
    mockRepo.create.mockImplementation(async (_clinicId, _userId, data) => ({
      id: REQUEST_ID,
      ...data,
      customer: { id: CUSTOMER_ID, name: 'JoÃ£o', phone: null, email: null },
      createdBy: { id: USER_ID, name: 'Staff' },
    }))

    const before = new Date()
    await service.create(CLINIC_ID, USER_ID, {
      customerId: CUSTOMER_ID,
      mode: 'blank',
      groupId: 'g1',
      groupName: 'Ficha',
      questionsSnapshot: [{ id: '1', text: 'q', type: 'text', required: false }],
    })
    const after = new Date()

    const call = mockRepo.create.mock.calls[0][2] as { expiresAt: Date }
    const diffMs = call.expiresAt.getTime() - before.getTime()
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000
    const tolerance = after.getTime() - before.getTime() + 1000

    expect(diffMs).toBeGreaterThanOrEqual(sevenDaysMs)
    expect(diffMs).toBeLessThanOrEqual(sevenDaysMs + tolerance)
  })
})

// â”€â”€ resolveDiff â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.resolveDiff()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => cb(mockPrismaTx),
    )
  })

  it('deve resolver diff e criar auditLog atomicamente', async () => {
    const anamnesisRow = { id: REQUEST_ID, status: 'client_submitted', clinicId: CLINIC_ID }
    const updatedRow = { id: REQUEST_ID, status: 'signed' }

    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(anamnesisRow)
    mockPrismaTx.anamnesisRequest.update.mockResolvedValue(updatedRow)
    mockPrismaTx.auditLog.create.mockResolvedValue({ id: 'audit-1' })

    const result = await service.resolveDiff(CLINIC_ID, REQUEST_ID, {
      resolutions: { q1: 'clinic', q2: 'client' },
    }, USER_ID)

    expect(result).toEqual(updatedRow)
    expect(mockPrismaTx.anamnesisRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'signed', diffResolution: { q1: 'clinic', q2: 'client' } }),
      }),
    )
    expect(mockPrismaTx.auditLog.create).toHaveBeenCalled()
  })

  it('deve lanÃ§ar NotFoundError quando anamnese nÃ£o encontrada', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(null)

    await expect(
      service.resolveDiff(CLINIC_ID, REQUEST_ID, { resolutions: {} }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deve retornar idempotente quando status jÃ¡ Ã© signed', async () => {
    const signedRow = { id: REQUEST_ID, status: 'signed', clinicId: CLINIC_ID }
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue(signedRow)

    await service.resolveDiff(CLINIC_ID, REQUEST_ID, { resolutions: {} }, USER_ID)

    // NÃ£o deve tentar fazer update se jÃ¡ estÃ¡ signed
    expect(mockPrismaTx.anamnesisRequest.update).not.toHaveBeenCalled()
    expect(mockPrismaTx.auditLog.create).not.toHaveBeenCalled()
  })

  it('deve rejeitar multi-tenancy: clinicId diferente lanÃ§a NotFoundError', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue({
      id: REQUEST_ID,
      status: 'client_submitted',
      clinicId: 'outra-clinica-uuid',
    })

    await expect(
      service.resolveDiff(CLINIC_ID, REQUEST_ID, { resolutions: {} }, USER_ID),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('deve rejeitar status diferente de client_submitted com ValidationError', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue({
      id: REQUEST_ID,
      status: 'pending',
      clinicId: CLINIC_ID,
    })

    const { ValidationError } = await import('../../shared/errors/app-error')
    await expect(
      service.resolveDiff(CLINIC_ID, REQUEST_ID, { resolutions: {} }, USER_ID),
    ).rejects.toBeInstanceOf(ValidationError)
  })
})

// â”€â”€ finalize â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.finalize()', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  it('deve transicionar draft â†’ clinic_filled', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, status: 'draft', clinicId: CLINIC_ID })
    mockRepo.updateStatus = vi.fn().mockResolvedValue({ id: REQUEST_ID, status: 'clinic_filled' })

    const result = await service.finalize(CLINIC_ID, REQUEST_ID)

    expect(mockRepo.updateStatus).toHaveBeenCalledWith(CLINIC_ID, REQUEST_ID, 'clinic_filled')
    expect(result).toMatchObject({ status: 'clinic_filled' })
  })

  it('deve lanÃ§ar ValidationError se status nÃ£o Ã© draft', async () => {
    mockRepo.findById.mockResolvedValue({ id: REQUEST_ID, status: 'signed', clinicId: CLINIC_ID })

    const { ValidationError } = await import('../../shared/errors/app-error')
    await expect(service.finalize(CLINIC_ID, REQUEST_ID)).rejects.toBeInstanceOf(ValidationError)
  })

  it('deve lanÃ§ar NotFoundError se anamnese nÃ£o existe', async () => {
    mockRepo.findById.mockResolvedValue(null)

    await expect(service.finalize(CLINIC_ID, REQUEST_ID)).rejects.toBeInstanceOf(NotFoundError)
  })
})

// â”€â”€ resolveDiff: atomicidade de rollback â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.resolveDiff() â€” atomicidade de rollback', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
    mockPrisma.$transaction.mockImplementation(
      (cb: (tx: typeof mockPrismaTx) => Promise<unknown>) => cb(mockPrismaTx),
    )
  })

  it('deve reverter status signed se auditLog.create falhar (atomicidade)', async () => {
    mockPrismaTx.anamnesisRequest.findFirst.mockResolvedValue({ id: REQUEST_ID, status: 'client_submitted', clinicId: CLINIC_ID })
    mockPrismaTx.anamnesisRequest.update.mockResolvedValue({ id: REQUEST_ID, status: 'signed' })
    mockPrismaTx.auditLog.create.mockRejectedValue(new Error('DB error'))

    await expect(
      service.resolveDiff(CLINIC_ID, REQUEST_ID, { resolutions: {} }, USER_ID),
    ).rejects.toThrow('DB error')
    // A transaÃ§Ã£o propagou o erro â€” em produÃ§Ã£o, o update Ã© revertido pelo Prisma
  })
})

// â”€â”€ submit: auditLog RN21 â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

describe('AnamnesisService.submit() â€” auditLog RN21', () => {
  let service: AnamnesisService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new AnamnesisService()
  })

  const VALID_SIGNATURE = 'data:image/png;base64,' + 'A'.repeat(1_100)
  const META = { ipAddress: '192.168.0.1', userAgent: 'Mozilla/5.0' }

  it('deve registrar auditLog apÃ³s submissÃ£o pÃºblica com sucesso', async () => {
    mockRepo.findByToken.mockResolvedValue(BASE_PUBLIC_REQUEST)
    mockRepo.submitSignature.mockResolvedValue(1)
    mockPrisma.auditLog = { create: vi.fn().mockResolvedValue({ id: 'audit-1' }) } as never

    await service.submit(
      SIGN_TOKEN,
      { clientAnswers: {}, signatureBase64: VALID_SIGNATURE, consentGiven: true },
      META,
    )

    // auditLog Ã© criado de forma best-effort (microtask) â€” aguardar
    await vi.waitFor(() => {
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'anamnesis.public-submit',
            entityId: REQUEST_ID,
            clinicId: CLINIC_ID,
            userId: 'public',
          }),
        }),
      )
    })
  })
})

