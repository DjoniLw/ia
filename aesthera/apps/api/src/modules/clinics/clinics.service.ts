import { appConfig } from '../../config/app.config'
import { companyConfig } from '../../config/company.config'
import { logger } from '../../shared/logger/logger'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors/app-error'
import type { SetBusinessHoursDto, UpdateClinicDto } from './clinics.dto'
import { ClinicsRepository } from './clinics.repository'

function normalizeCnpj(value?: string | null): string | undefined {
  const digits = value?.replace(/\D/g, '') ?? ''
  return digits.length > 0 ? digits : undefined
}

function validateCnpjDigits(digits: string): boolean {
  if (digits.length !== 14) return false
  if (/^(\d)\1+$/.test(digits)) return false

  const calc = (len: number): number => {
    let sum = 0
    let factor = len - 7
    for (let index = 0; index < len; index++) {
      sum += parseInt(digits[index], 10) * factor--
      if (factor < 2) factor = 9
    }
    const remainder = sum % 11
    return remainder < 2 ? 0 : 11 - remainder
  }

  return calc(12) === parseInt(digits[12], 10) && calc(13) === parseInt(digits[13], 10)
}

function supportContactText(): string {
  if (companyConfig.supportWhatsapp) {
    return `WhatsApp: ${companyConfig.supportWhatsapp}`
  }

  if (companyConfig.supportEmail) {
    return `e-mail: ${companyConfig.supportEmail}`
  }

  return 'nosso suporte'
}

export class ClinicsService {
  private repo = new ClinicsRepository()

  async getMe(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic not found')
    return clinic
  }

  async updateMe(clinicId: string, data: UpdateClinicDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic not found')

    const document = normalizeCnpj(data.document)
    if (data.document !== undefined) {
      if (document) {
        if (appConfig.isProduction && !validateCnpjDigits(document)) {
          throw new AppError('CNPJ inválido. Verifique os dígitos informados.', 422, 'INVALID_CNPJ')
        }

        const existingClinic = await this.repo.findByDocument(document)
        if (existingClinic && existingClinic.id !== clinicId) {
          throw new ConflictError(`Este CNPJ já está cadastrado em outra empresa. Em caso de dúvidas, entre em contato com ${supportContactText()}.`)
        }

        if (appConfig.isProduction) {
          const lookup = await this.lookupBrasilApi(document)
          if (lookup === 'not_found') {
            throw new AppError('CNPJ não encontrado na Receita Federal.', 422, 'CNPJ_NOT_FOUND_RF')
          }
        }
      }

      data.document = document
    }

    return this.repo.update(clinicId, data)
  }

  async lookupCnpj(cnpj: string) {
    const digits = normalizeCnpj(cnpj)
    if (!digits || digits.length !== 14) {
      throw new AppError('CNPJ deve ter 14 dígitos.', 422, 'INVALID_CNPJ')
    }

    const lookup = await this.lookupBrasilApi(digits)
    if (lookup === 'not_found') {
      throw new AppError('CNPJ não encontrado na Receita Federal.', 422, 'CNPJ_NOT_FOUND_RF')
    }

    return lookup ?? {}
  }

  async getBusinessHours(clinicId: string) {
    return this.repo.getBusinessHours(clinicId)
  }

  async setBusinessHours(clinicId: string, dto: SetBusinessHoursDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic not found')
    return this.repo.setBusinessHours(clinicId, dto.hours)
  }

  private async lookupBrasilApi(cnpj: string): Promise<Record<string, unknown> | 'not_found' | null> {
    // TODO: A BrasilAPI confirma apenas dados públicos do CNPJ, não a titularidade da empresa.
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      if (response.status === 404) return 'not_found'
      if (!response.ok) {
        logger.warn({ cnpj, status: response.status }, 'BrasilAPI indisponível durante consulta de CNPJ')
        return null
      }

      const data = await response.json() as Record<string, unknown>
      return {
        razaoSocial: data.razao_social ?? '',
        nomeFantasia: data.nome_fantasia ?? '',
        telefone: data.ddd_telefone_1 ?? '',
        email: data.email ?? '',
        cep: data.cep ?? '',
        logradouro: data.logradouro ?? '',
        municipio: data.municipio ?? '',
        uf: data.uf ?? '',
      }
    } catch (error) {
      logger.warn({ error, cnpj }, 'Falha ao consultar BrasilAPI para CNPJ')
      return null
    }
  }
}
