import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockRepo = vi.hoisted(() => ({
  findById: vi.fn(),
  update: vi.fn(),
  findByDocument: vi.fn(),
  getBusinessHours: vi.fn(),
  setBusinessHours: vi.fn(),
  findPaymentMethodConfig: vi.fn(),
  upsertPaymentMethodConfig: vi.fn(),
}))

vi.mock('./clinics.repository', () => ({
  ClinicsRepository: vi.fn(function ClinicsRepository() {
    return mockRepo
  }),
}))

import { AppError, NotFoundError } from '../../shared/errors/app-error'
import { ClinicsService } from './clinics.service'

describe('ClinicsService.getPaymentMethodConfig()', () => {
  let service: ClinicsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ClinicsService()
  })

  it('deve retornar defaults quando a clínica não possui configuração salva', async () => {
    mockRepo.findById.mockResolvedValue({ id: 'clinic-1' })
    mockRepo.findPaymentMethodConfig.mockResolvedValue(null)

    const result = await service.getPaymentMethodConfig('clinic-1')

    expect(result).toMatchObject({
      pixEnabled: true,
      boletoEnabled: true,
      cardEnabled: true,
      installmentsEnabled: false,
      duplicataEnabled: false,
      installmentsMinAmount: 10000,
    })
  })

  it('deve lançar erro quando a clínica não existir', async () => {
    mockRepo.findById.mockResolvedValue(null)

    await expect(service.getPaymentMethodConfig('clinic-404')).rejects.toBeInstanceOf(NotFoundError)
  })
})

describe('ClinicsService.updatePaymentMethodConfig()', () => {
  let service: ClinicsService

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ClinicsService()
    mockRepo.findById.mockResolvedValue({ id: 'clinic-1' })
  })

  it('deve salvar configuração válida de formas de pagamento', async () => {
    const dto = {
      pixEnabled: true,
      boletoEnabled: true,
      cardEnabled: true,
      installmentsEnabled: true,
      installmentsMaxMonths: 6,
      installmentsMinAmount: 15000,
      duplicataEnabled: true,
      duplicataDaysInterval: 30,
      duplicataMaxInstallments: 3,
    }

    mockRepo.upsertPaymentMethodConfig.mockResolvedValue({ clinicId: 'clinic-1', ...dto })

    const result = await service.updatePaymentMethodConfig('clinic-1', dto)

    expect(mockRepo.upsertPaymentMethodConfig).toHaveBeenCalledWith('clinic-1', dto)
    expect(result).toMatchObject({ duplicataEnabled: true, installmentsEnabled: true })
  })

  it('deve rejeitar parcelamento quando cartão estiver desabilitado', async () => {
    await expect(
      service.updatePaymentMethodConfig('clinic-1', {
        pixEnabled: true,
        boletoEnabled: false,
        cardEnabled: false,
        installmentsEnabled: true,
        installmentsMaxMonths: 6,
        installmentsMinAmount: 10000,
        duplicataEnabled: false,
        duplicataDaysInterval: 30,
        duplicataMaxInstallments: 3,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('deve rejeitar configuração sem nenhuma forma de pagamento ativa', async () => {
    await expect(
      service.updatePaymentMethodConfig('clinic-1', {
        pixEnabled: false,
        boletoEnabled: false,
        cardEnabled: false,
        installmentsEnabled: false,
        installmentsMaxMonths: 12,
        installmentsMinAmount: 10000,
        duplicataEnabled: true,
        duplicataDaysInterval: 30,
        duplicataMaxInstallments: 6,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })

  it('deve rejeitar duplicata sem PIX ou boleto habilitados', async () => {
    await expect(
      service.updatePaymentMethodConfig('clinic-1', {
        pixEnabled: false,
        boletoEnabled: false,
        cardEnabled: true,
        installmentsEnabled: false,
        installmentsMaxMonths: 12,
        installmentsMinAmount: 10000,
        duplicataEnabled: true,
        duplicataDaysInterval: 30,
        duplicataMaxInstallments: 6,
      }),
    ).rejects.toBeInstanceOf(AppError)
  })
})
