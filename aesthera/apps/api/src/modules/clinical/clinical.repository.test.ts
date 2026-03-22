import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  clinicalRecord: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('../../database/prisma/client', () => ({
  prisma: mockPrisma,
}))

import { ClinicalRepository } from './clinical.repository'

describe('ClinicalRepository.update()', () => {
  let repo: ClinicalRepository

  beforeEach(() => {
    vi.clearAllMocks()
    repo = new ClinicalRepository()
  })

  it('deve verificar o clinicId via findFirst antes de atualizar', async () => {
    const existing = { id: 'rec-001', clinicId: 'clinic-abc' }
    const updated = { ...existing, title: 'Atualizado', professional: null }
    mockPrisma.clinicalRecord.findFirst.mockResolvedValue(existing)
    mockPrisma.clinicalRecord.update.mockResolvedValue(updated)

    await repo.update('clinic-abc', 'rec-001', { title: 'Atualizado' })

    // Garante que findFirst filtra por clinicId (isolamento cross-tenant)
    expect(mockPrisma.clinicalRecord.findFirst).toHaveBeenCalledWith({
      where: { id: 'rec-001', clinicId: 'clinic-abc' },
    })
    // Garante que update usa somente o @id único
    expect(mockPrisma.clinicalRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'rec-001' } }),
    )
  })

  it('deve lançar NotFoundError ao tentar atualizar prontuário de outra clínica', async () => {
    // findFirst retorna null — o registro não existe para este tenant
    mockPrisma.clinicalRecord.findFirst.mockResolvedValue(null)

    await expect(
      repo.update('clinic-intruso', 'rec-001', { title: 'Hack' }),
    ).rejects.toMatchObject({ message: expect.stringContaining('ClinicalRecord') })

    // Jamais deve chamar update quando não encontrado
    expect(mockPrisma.clinicalRecord.update).not.toHaveBeenCalled()
  })

  it('deve atualizar normalmente com clinicId correto e id válido', async () => {
    const existing = { id: 'rec-002', clinicId: 'clinic-xyz' }
    const updated = {
      id: 'rec-002',
      clinicId: 'clinic-xyz',
      title: 'Nota pós-procedimento',
      content: 'Tudo bem',
      type: 'note',
      professional: { id: 'prof-1', name: 'Dr. Ana' },
    }
    mockPrisma.clinicalRecord.findFirst.mockResolvedValue(existing)
    mockPrisma.clinicalRecord.update.mockResolvedValue(updated)

    const result = await repo.update('clinic-xyz', 'rec-002', {
      title: 'Nota pós-procedimento',
      content: 'Tudo bem',
    })

    expect(result).toEqual(updated)
  })
})

