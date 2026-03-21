import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRepo = vi.hoisted(() => ({
  findAll: vi.fn(),
  findById: vi.fn(),
  findByEmail: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  softDelete: vi.fn(),
  getWorkingHours: vi.fn(),
  setWorkingHours: vi.fn(),
  getServices: vi.fn(),
  assignServices: vi.fn(),
}))

vi.mock('./professionals.repository', () => ({
  ProfessionalsRepository: vi.fn(function ProfessionalsRepository() {
    return mockRepo
  }),
}))

import { ConflictError, NotFoundError } from '../../shared/errors/app-error'
import { ProfessionalsService } from './professionals.service'

describe('ProfessionalsService.create()', () => {
  let service: ProfessionalsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProfessionalsService()
  })

  it('deve criar profissional com endereço quando o e-mail ainda não existe', async () => {
    const dto = {
      name: 'Ana Lima',
      email: 'ana@clinica.com',
      phone: '11999998888',
      speciality: 'Esteticista',
      address: {
        street: 'Rua das Flores',
        neighborhood: 'Centro',
        city: 'São Paulo',
        state: 'SP',
        zip: '01001000',
      },
    }

    mockRepo.findByEmail.mockResolvedValue(null)
    mockRepo.create.mockResolvedValue({ id: 'professional-1', clinicId: 'clinic-1', ...dto })

    const result = await service.create('clinic-1', dto)

    expect(mockRepo.findByEmail).toHaveBeenCalledWith('clinic-1', dto.email)
    expect(mockRepo.create).toHaveBeenCalledWith('clinic-1', dto)
    expect(result).toMatchObject({ address: dto.address })
  })

  it('deve lançar conflito quando já existir profissional com o mesmo e-mail na clínica', async () => {
    mockRepo.findByEmail.mockResolvedValue({ id: 'professional-1' })

    await expect(
      service.create('clinic-1', {
        name: 'Ana Lima',
        email: 'ana@clinica.com',
      }),
    ).rejects.toBeInstanceOf(ConflictError)
  })
})

describe('ProfessionalsService.update()', () => {
  let service: ProfessionalsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProfessionalsService()
  })

  it('deve atualizar endereço do profissional existente', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'professional-1', clinicId: 'clinic-1' })
    mockRepo.update.mockResolvedValue({
      id: 'professional-1',
      address: {
        street: 'Rua Nova',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        state: 'SP',
        zip: '01414001',
      },
    })

    const result = await service.update('clinic-1', 'professional-1', {
      address: {
        street: 'Rua Nova',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        state: 'SP',
        zip: '01414001',
      },
    })

    expect(mockRepo.findById).toHaveBeenCalledWith('clinic-1', 'professional-1')
    expect(mockRepo.update).toHaveBeenCalledWith('clinic-1', 'professional-1', {
      address: {
        street: 'Rua Nova',
        neighborhood: 'Jardins',
        city: 'São Paulo',
        state: 'SP',
        zip: '01414001',
      },
    })
    expect(result).toMatchObject({ address: { city: 'São Paulo' } })
  })

  it('deve lançar erro quando o profissional não existir na clínica', async () => {
    mockRepo.findById.mockResolvedValue(null)

    await expect(
      service.update('clinic-1', 'professional-inexistente', { speciality: 'Dermatologista' }),
    ).rejects.toBeInstanceOf(NotFoundError)
  })
})