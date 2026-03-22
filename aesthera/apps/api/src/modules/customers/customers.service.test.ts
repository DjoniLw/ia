import { beforeEach, describe, expect, it, vi } from 'vitest'

// ── Mocks (hoisted antes de qualquer import) ──────────────────────────────────

/** Objeto que simula o cliente de transação Prisma (tx) */
const mockTx = vi.hoisted(() => ({
  customer: {
    findFirst: vi.fn(),
    updateMany: vi.fn(),
  },
  clinicalRecord: {
    deleteMany: vi.fn(),
  },
}))

/** Mock do cliente Prisma principal */
const mockPrisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
}))

vi.mock('../../database/prisma/client', () => ({ prisma: mockPrisma }))

/** Mock do createAuditLog para inspecionar chamadas sem efeito colateral */
vi.mock('../../shared/audit', () => ({ createAuditLog: vi.fn() }))

/** Mock do repositório — anonymize() não o usa, mas a instância do service exige */
vi.mock('./customers.repository', () => ({
  CustomersRepository: vi.fn(function CustomersRepository() {
    return {
      findAll: vi.fn(),
      findById: vi.fn(),
      findByEmail: vi.fn(),
      findByDocument: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      softDelete: vi.fn(),
    }
  }),
}))

// ── Imports após mocks ────────────────────────────────────────────────────────

import { NotFoundError } from '../../shared/errors/app-error'
import { createAuditLog } from '../../shared/audit'
import { CustomersService } from './customers.service'

// ── Tipos auxiliares ─────────────────────────────────────────────────────────

type TxCallback = (tx: typeof mockTx) => Promise<void>

// ── Testes ────────────────────────────────────────────────────────────────────

describe('CustomersService.anonymize()', () => {
  let service: CustomersService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new CustomersService()

    // $transaction executa o callback imediatamente com o tx mockado
    mockPrisma.$transaction.mockImplementation(async (cb: TxCallback) => cb(mockTx))

    // Valores padrão para operações de escrita
    mockTx.customer.updateMany.mockResolvedValue({ count: 1 })
    mockTx.clinicalRecord.deleteMany.mockResolvedValue({ count: 1 })
  })

  // ── Caso feliz ────────────────────────────────────────────────────────────

  it('deve substituir todos os campos PII do cliente', async () => {
    mockTx.customer.findFirst.mockResolvedValue({ id: 'cust-1', clinicId: 'clinic-1' })

    await service.anonymize('clinic-1', 'cust-1', 'actor-1', '10.0.0.1')

    expect(mockTx.customer.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'cust-1', clinicId: 'clinic-1' },
        data: expect.objectContaining({
          name: 'Cliente Anonimizado',
          phone: '00000000000',
          document: null,
          birthDate: null,
          notes: null,
          externalId: null,
        }),
      }),
    )
  })

  it('deve excluir os ClinicalRecords do cliente dentro da transação', async () => {
    mockTx.customer.findFirst.mockResolvedValue({ id: 'cust-1', clinicId: 'clinic-1' })

    await service.anonymize('clinic-1', 'cust-1', 'actor-1')

    expect(mockTx.clinicalRecord.deleteMany).toHaveBeenCalledWith({
      where: { customerId: 'cust-1', clinicId: 'clinic-1' },
    })
  })

  it('deve registrar audit log com action customer.anonymized após a transação', async () => {
    mockTx.customer.findFirst.mockResolvedValue({ id: 'cust-1', clinicId: 'clinic-1' })

    await service.anonymize('clinic-1', 'cust-1', 'actor-1', '10.0.0.1')

    expect(createAuditLog).toHaveBeenCalledOnce()
    expect(createAuditLog).toHaveBeenCalledWith({
      clinicId: 'clinic-1',
      userId: 'actor-1',
      action: 'customer.anonymized',
      entityId: 'cust-1',
      ip: '10.0.0.1',
    })
  })

  it('deve excluir ClinicalRecords antes de anonimizar (ordem da transação)', async () => {
    mockTx.customer.findFirst.mockResolvedValue({ id: 'cust-1', clinicId: 'clinic-1' })
    const callOrder: string[] = []
    mockTx.clinicalRecord.deleteMany.mockImplementation(async () => {
      callOrder.push('deleteMany')
      return { count: 1 }
    })
    mockTx.customer.updateMany.mockImplementation(async () => {
      callOrder.push('updateMany')
      return { count: 1 }
    })

    await service.anonymize('clinic-1', 'cust-1', 'actor-1')

    expect(callOrder).toEqual(['deleteMany', 'updateMany'])
  })

  // ── Tenant inválido ───────────────────────────────────────────────────────

  it('deve lançar NotFoundError quando o cliente pertence a outra clínica (tenant inválido)', async () => {
    // findFirst com clinicId diferente retorna null — garantia de isolamento multi-tenant
    mockTx.customer.findFirst.mockResolvedValue(null)

    await expect(
      service.anonymize('clinic-outra', 'cust-1', 'actor-1'),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(mockTx.customer.updateMany).not.toHaveBeenCalled()
    expect(mockTx.clinicalRecord.deleteMany).not.toHaveBeenCalled()
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it('deve verificar isolamento de tenant passando clinicId no findFirst', async () => {
    mockTx.customer.findFirst.mockResolvedValue(null)

    await expect(
      service.anonymize('clinic-alvo', 'cust-1', 'actor-1'),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(mockTx.customer.findFirst).toHaveBeenCalledWith({
      where: { id: 'cust-1', clinicId: 'clinic-alvo' },
    })
  })

  // ── Cliente inexistente ───────────────────────────────────────────────────

  it('deve lançar NotFoundError quando o cliente não existe', async () => {
    mockTx.customer.findFirst.mockResolvedValue(null)

    await expect(
      service.anonymize('clinic-1', 'cust-inexistente', 'actor-1'),
    ).rejects.toBeInstanceOf(NotFoundError)

    expect(mockTx.customer.updateMany).not.toHaveBeenCalled()
    expect(createAuditLog).not.toHaveBeenCalled()
  })

  it('deve retornar a mensagem correta na NotFoundError para cliente inexistente', async () => {
    mockTx.customer.findFirst.mockResolvedValue(null)

    const err = await service
      .anonymize('clinic-1', 'cust-inexistente', 'actor-1')
      .catch((e: unknown) => e)

    expect(err).toBeInstanceOf(NotFoundError)
    expect((err as NotFoundError).message).toBe('Customer not found')
  })
})
