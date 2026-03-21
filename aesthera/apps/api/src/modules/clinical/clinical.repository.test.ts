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

  it('deve incluir clinicId no where clause ao atualizar', async () => {
    const record = {
      id: 'rec-001',
      clinicId: 'clinic-abc',
      title: 'Atualizado',
      content: 'Conteúdo',
      type: 'note',
      professional: null,
    }
    mockPrisma.clinicalRecord.update.mockResolvedValue(record)

    await repo.update('clinic-abc', 'rec-001', { title: 'Atualizado' })

    expect(mockPrisma.clinicalRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-001', clinicId: 'clinic-abc' },
      }),
    )
  })

  it('deve falhar (RecordNotFound) ao tentar atualizar prontuário de outra clínica', async () => {
    const prismaError = Object.assign(new Error('Record not found'), {
      code: 'P2025',
    })
    mockPrisma.clinicalRecord.update.mockRejectedValue(prismaError)

    await expect(
      repo.update('clinic-intruso', 'rec-001', { title: 'Hack' }),
    ).rejects.toMatchObject({ code: 'P2025' })

    // Garantia: o where sempre inclui clinicId
    expect(mockPrisma.clinicalRecord.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-001', clinicId: 'clinic-intruso' },
      }),
    )
  })

  it('deve atualizar normalmente com clinicId correto e id válido', async () => {
    const updated = {
      id: 'rec-002',
      clinicId: 'clinic-xyz',
      title: 'Nota pós-procedimento',
      content: 'Tudo bem',
      type: 'note',
      professional: { id: 'prof-1', name: 'Dr. Ana' },
    }
    mockPrisma.clinicalRecord.update.mockResolvedValue(updated)

    const result = await repo.update('clinic-xyz', 'rec-002', {
      title: 'Nota pós-procedimento',
      content: 'Tudo bem',
    })

    expect(result).toEqual(updated)
  })
})
