import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockRepo = vi.hoisted(() => ({
  findContractById: vi.fn(),
  updateContract: vi.fn(),
}))

const mockPrisma = vi.hoisted(() => ({
  customer: { findFirst: vi.fn() },
  customerContract: { findFirst: vi.fn() },
}))

const mockNotificationsService = vi.hoisted(() => ({
  sendWhatsApp: vi.fn(),
}))

const mockGetObjectBuffer = vi.hoisted(() => vi.fn())
const mockGeneratePresignedGetUrl = vi.hoisted(() => vi.fn())
const mockCreateHash = vi.hoisted(() => {
  const hash = { update: vi.fn(), digest: vi.fn() }
  hash.update.mockReturnValue(hash)
  return { createHash: vi.fn(() => hash), _hash: hash }
})

vi.mock('../../database/prisma/client', () => ({ prisma: mockPrisma }))

vi.mock('../notifications/notifications.service', () => ({
  NotificationsService: vi.fn(function NotificationsService() {
    return mockNotificationsService
  }),
}))

vi.mock('./contracts.repository', () => ({
  ContractsRepository: vi.fn(function ContractsRepository() {
    return mockRepo
  }),
}))

vi.mock('../../integrations/r2/r2.service', () => ({
  generatePresignedPutUrl: vi.fn(),
  generatePresignedGetUrl: mockGeneratePresignedGetUrl,
  getObjectBuffer: mockGetObjectBuffer,
}))

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>()
  return {
    ...actual,
    default: {
      ...actual,
      createHash: mockCreateHash.createHash,
    },
  }
})

import { ContractsService } from './contracts.service'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors/app-error'

// ── Constantes de apoio ───────────────────────────────────────────────────────

const CLINIC_ID = 'clinic-1'
const CUSTOMER_ID = 'customer-1'
const CONTRACT_ID = 'contract-1'

const BASE_CONTRACT = {
  id: CONTRACT_ID,
  clinicId: CLINIC_ID,
  customerId: CUSTOMER_ID,
  status: 'pending',
  signatureMode: null,
  template: { storageKey: 'templates/clinic-1/tmpl.pdf', name: 'Contrato Padrão' },
}

// ── signManual ────────────────────────────────────────────────────────────────

describe('ContractsService.signManual()', () => {
  let service: ContractsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContractsService()
  })

  it('deve salvar signerIp, signerUserAgent, signerCpf e documentHash ao assinar', async () => {
    mockRepo.findContractById.mockResolvedValue(BASE_CONTRACT)
    mockPrisma.customer.findFirst.mockResolvedValue({ document: '123.456.789-00' })
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('pdf-content'))
    mockCreateHash._hash.digest.mockReturnValue('hash-sha256-abc')
    mockRepo.updateContract.mockResolvedValue({ ...BASE_CONTRACT, status: 'signed' })

    await service.signManual(
      CLINIC_ID,
      CUSTOMER_ID,
      CONTRACT_ID,
      { signature: 'data:image/png;base64,abc123' },
      '192.168.0.1',
      'Mozilla/5.0 (Test)',
    )

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({
        status: 'signed',
        signatureMode: 'manual',
        signerIp: '192.168.0.1',
        signerUserAgent: 'Mozilla/5.0 (Test)',
        signerCpf: '123.456.789-00',
        documentHash: 'hash-sha256-abc',
      }),
    )
  })

  it('deve salvar signerCpf como null quando o cliente não tem CPF', async () => {
    mockRepo.findContractById.mockResolvedValue(BASE_CONTRACT)
    mockPrisma.customer.findFirst.mockResolvedValue({ document: null })
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('pdf'))
    mockCreateHash._hash.digest.mockReturnValue('hash-abc')
    mockRepo.updateContract.mockResolvedValue({ ...BASE_CONTRACT, status: 'signed' })

    await service.signManual(
      CLINIC_ID,
      CUSTOMER_ID,
      CONTRACT_ID,
      { signature: 'data:image/png;base64,abc' },
    )

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({ signerCpf: null }),
    )
  })

  it('deve salvar documentHash como null quando template não tem storageKey', async () => {
    const contractWithoutPdf = { ...BASE_CONTRACT, template: { storageKey: null, name: 'Sem PDF' } }
    mockRepo.findContractById.mockResolvedValue(contractWithoutPdf)
    mockPrisma.customer.findFirst.mockResolvedValue({ document: '111.222.333-44' })
    mockRepo.updateContract.mockResolvedValue({ ...contractWithoutPdf, status: 'signed' })

    await service.signManual(
      CLINIC_ID,
      CUSTOMER_ID,
      CONTRACT_ID,
      { signature: 'data:image/png;base64,abc' },
    )

    expect(mockGetObjectBuffer).not.toHaveBeenCalled()
    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({ documentHash: null }),
    )
  })

  it('deve salvar documentHash como null quando o template é null (contrato avulso)', async () => {
    const standaloneContract = { ...BASE_CONTRACT, template: null }
    mockRepo.findContractById.mockResolvedValue(standaloneContract)
    mockPrisma.customer.findFirst.mockResolvedValue({ document: null })
    mockRepo.updateContract.mockResolvedValue({ ...standaloneContract, status: 'signed' })

    await service.signManual(
      CLINIC_ID,
      CUSTOMER_ID,
      CONTRACT_ID,
      { signature: 'data:image/png;base64,abc' },
    )

    expect(mockGetObjectBuffer).not.toHaveBeenCalled()
    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({ documentHash: null }),
    )
  })

  it('deve continuar a assinatura mesmo quando o R2 falha ao calcular o hash', async () => {
    mockRepo.findContractById.mockResolvedValue(BASE_CONTRACT)
    mockPrisma.customer.findFirst.mockResolvedValue({ document: '000.000.000-00' })
    mockGetObjectBuffer.mockRejectedValue(new Error('R2 indisponível'))
    mockRepo.updateContract.mockResolvedValue({ ...BASE_CONTRACT, status: 'signed' })

    await expect(
      service.signManual(
        CLINIC_ID,
        CUSTOMER_ID,
        CONTRACT_ID,
        { signature: 'data:image/png;base64,abc' },
        '10.0.0.1',
      ),
    ).resolves.not.toThrow()

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({ documentHash: null }),
    )
  })

  it('deve lançar ConflictError quando contrato já está assinado', async () => {
    mockRepo.findContractById.mockResolvedValue({ ...BASE_CONTRACT, status: 'signed' })

    await expect(
      service.signManual(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(ConflictError)
  })

  it('deve lançar NotFoundError quando contrato não pertence ao cliente', async () => {
    mockRepo.findContractById.mockResolvedValue({ ...BASE_CONTRACT, customerId: 'outro-customer' })

    await expect(
      service.signManual(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(NotFoundError)
  })
})

// ── getAuditTrail ─────────────────────────────────────────────────────────────

describe('ContractsService.getAuditTrail()', () => {
  let service: ContractsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContractsService()
  })

  it('deve retornar todos os campos de auditoria do contrato assinado', async () => {
    const signedContract = {
      ...BASE_CONTRACT,
      status: 'signed',
      signatureMode: 'manual',
      signedAt: new Date('2026-03-29T12:00:00Z'),
      signerIp: '192.168.0.5',
      signerUserAgent: 'Mozilla/5.0',
      signerCpf: '111.222.333-44',
      documentHash: 'abc123hash',
    }
    mockRepo.findContractById.mockResolvedValue(signedContract)

    const result = await service.getAuditTrail(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID)

    expect(result).toEqual({
      contractId: CONTRACT_ID,
      status: 'signed',
      signatureMode: 'manual',
      signedAt: signedContract.signedAt,
      signerIp: '192.168.0.5',
      signerUserAgent: 'Mozilla/5.0',
      signerCpf: '111.222.333-44',
      documentHash: 'abc123hash',
    })
  })

  it('deve lançar NotFoundError quando contrato não existe', async () => {
    mockRepo.findContractById.mockResolvedValue(null)

    await expect(
      service.getAuditTrail(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID),
    ).rejects.toThrow(NotFoundError)
  })

  it('deve lançar NotFoundError quando contrato pertence a outro cliente', async () => {
    mockRepo.findContractById.mockResolvedValue({ ...BASE_CONTRACT, customerId: 'outro' })

    await expect(
      service.getAuditTrail(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID),
    ).rejects.toThrow(NotFoundError)
  })
})

// ── generateSignToken ─────────────────────────────────────────────────────────

describe('ContractsService.generateSignToken()', () => {
  let service: ContractsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContractsService()
  })

  it('deve gerar token e chamar sendWhatsApp com o telefone informado', async () => {
    mockRepo.findContractById.mockResolvedValue(BASE_CONTRACT)
    mockPrisma.customer.findFirst.mockResolvedValue({ name: 'Ana Silva' })
    mockRepo.updateContract.mockResolvedValue({ ...BASE_CONTRACT, signToken: 'uuid-token' })
    mockNotificationsService.sendWhatsApp.mockResolvedValue(undefined)

    await service.generateSignToken(
      CLINIC_ID,
      CUSTOMER_ID,
      CONTRACT_ID,
      { phone: '5511999999999' },
    )

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({
        signToken: expect.any(String),
        signTokenExpiresAt: expect.any(Date),
      }),
    )
    expect(mockNotificationsService.sendWhatsApp).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '5511999999999' }),
    )
  })

  it('deve lançar ConflictError quando contrato já está assinado', async () => {
    mockRepo.findContractById.mockResolvedValue({ ...BASE_CONTRACT, status: 'signed' })

    await expect(
      service.generateSignToken(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID, { phone: '5511999999999' }),
    ).rejects.toThrow(ConflictError)
  })

  it('deve lançar NotFoundError quando contrato não existe', async () => {
    mockRepo.findContractById.mockResolvedValue(null)

    await expect(
      service.generateSignToken(CLINIC_ID, CUSTOMER_ID, CONTRACT_ID, { phone: '5511999999999' }),
    ).rejects.toThrow(NotFoundError)
  })
})

// ── getPublicContractInfo ─────────────────────────────────────────────────────

describe('ContractsService.getPublicContractInfo()', () => {
  let service: ContractsService

  const TOKEN = 'valid-token-uuid'
  const FUTURE_DATE = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const PAST_DATE = new Date(Date.now() - 1)

  const PUBLIC_CONTRACT = {
    id: CONTRACT_ID,
    clinicId: CLINIC_ID,
    customerId: CUSTOMER_ID,
    status: 'pending',
    signToken: TOKEN,
    signTokenExpiresAt: FUTURE_DATE,
    label: null,
    customer: { name: 'Ana Silva' },
    template: { name: 'Contrato Padrão', storageKey: 'templates/clinic-1/tmpl.pdf' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContractsService()
  })

  it('deve retornar informações públicas do contrato para token válido', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue(PUBLIC_CONTRACT)
    mockGeneratePresignedGetUrl.mockResolvedValue('https://cdn.example.com/doc.pdf')

    const result = await service.getPublicContractInfo(TOKEN)

    expect(result).toEqual(
      expect.objectContaining({
        contractId: CONTRACT_ID,
        contractName: 'Contrato Padrão',
        customerName: 'Ana Silva',
        fileUrl: 'https://cdn.example.com/doc.pdf',
      }),
    )
  })

  it('deve lançar AppError 410 quando token está expirado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue({
      ...PUBLIC_CONTRACT,
      signTokenExpiresAt: PAST_DATE,
    })

    await expect(service.getPublicContractInfo(TOKEN)).rejects.toThrow(AppError)
    await expect(service.getPublicContractInfo(TOKEN)).rejects.toMatchObject({ statusCode: 410 })
  })

  it('deve lançar AppError 409 quando contrato já está assinado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue({
      ...PUBLIC_CONTRACT,
      status: 'signed',
    })

    await expect(service.getPublicContractInfo(TOKEN)).rejects.toThrow(AppError)
    await expect(service.getPublicContractInfo(TOKEN)).rejects.toMatchObject({ statusCode: 409 })
  })

  it('deve lançar NotFoundError quando token não é encontrado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue(null)

    await expect(service.getPublicContractInfo(TOKEN)).rejects.toThrow(NotFoundError)
  })
})

// ── signRemote ────────────────────────────────────────────────────────────────

describe('ContractsService.signRemote()', () => {
  let service: ContractsService

  const TOKEN = 'valid-token-uuid'
  const FUTURE_DATE = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const PAST_DATE = new Date(Date.now() - 1)

  const REMOTE_CONTRACT = {
    id: CONTRACT_ID,
    clinicId: CLINIC_ID,
    customerId: CUSTOMER_ID,
    status: 'pending',
    signToken: TOKEN,
    signTokenExpiresAt: FUTURE_DATE,
    customer: { document: '123.456.789-00' },
    template: { storageKey: 'templates/clinic-1/tmpl.pdf' },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ContractsService()
  })

  it('deve assinar contrato, calcular hash e invalidar o token', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue(REMOTE_CONTRACT)
    mockGetObjectBuffer.mockResolvedValue(Buffer.from('pdf-content'))
    mockCreateHash._hash.digest.mockReturnValue('hash-sha256-remote')
    mockRepo.updateContract.mockResolvedValue({ ...REMOTE_CONTRACT, status: 'signed' })

    await service.signRemote(
      TOKEN,
      { signature: 'data:image/png;base64,abc' },
      '10.0.0.1',
      'Mozilla/5.0 (Mobile)',
    )

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({
        status: 'signed',
        signatureMode: 'remote',
        signerIp: '10.0.0.1',
        signerUserAgent: 'Mozilla/5.0 (Mobile)',
        signerCpf: '123.456.789-00',
        documentHash: 'hash-sha256-remote',
        signToken: null,
        signTokenExpiresAt: null,
      }),
    )
  })

  it('deve lançar AppError 410 quando token está expirado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue({
      ...REMOTE_CONTRACT,
      signTokenExpiresAt: PAST_DATE,
    })

    await expect(
      service.signRemote(TOKEN, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(AppError)
    await expect(
      service.signRemote(TOKEN, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toMatchObject({ statusCode: 410 })
  })

  it('deve lançar ConflictError quando contrato já está assinado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue({
      ...REMOTE_CONTRACT,
      status: 'signed',
    })

    await expect(
      service.signRemote(TOKEN, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(ConflictError)
  })

  it('deve lançar NotFoundError quando token não é encontrado', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue(null)

    await expect(
      service.signRemote(TOKEN, { signature: 'data:image/png;base64,abc' }),
    ).rejects.toThrow(NotFoundError)
  })

  it('deve manter documentHash como null quando R2 falha', async () => {
    mockPrisma.customerContract.findFirst.mockResolvedValue(REMOTE_CONTRACT)
    mockGetObjectBuffer.mockRejectedValue(new Error('R2 indisponível'))
    mockRepo.updateContract.mockResolvedValue({ ...REMOTE_CONTRACT, status: 'signed' })

    await service.signRemote(TOKEN, { signature: 'data:image/png;base64,abc' })

    expect(mockRepo.updateContract).toHaveBeenCalledWith(
      CLINIC_ID,
      CONTRACT_ID,
      expect.objectContaining({ documentHash: null }),
    )
  })
})
