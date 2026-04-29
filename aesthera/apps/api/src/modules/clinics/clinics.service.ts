import { appConfig } from '../../config/app.config'
import { companyConfig } from '../../config/company.config'
import { logger } from '../../shared/logger/logger'
import { AppError, ConflictError, NotFoundError } from '../../shared/errors/app-error'
import type {
  SetBusinessHoursDto,
  UpdateClinicDto,
  UpdatePaymentMethodConfigDto,
  UpdateSmtpSettingsDto,
  UpdateWhatsappSettingsDto,
} from './clinics.dto'
import { ClinicsRepository } from './clinics.repository'
import { normalizePaymentMethodConfig } from './payment-method-config'

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
    if (!clinic) throw new NotFoundError('Clinic')
    return clinic
  }

  async updateMe(clinicId: string, data: UpdateClinicDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')

    const document = normalizeCnpj(data.document)
    if (data.document !== undefined) {
      if (document) {
        if (appConfig.isProduction && !validateCnpjDigits(document)) {
          throw new AppError('CNPJ inválido. Verifique os dígitos informados.', 422, 'INVALID_CNPJ')
        }

        const existingClinic = await this.repo.findByDocument(document)
        if (existingClinic && existingClinic.id !== clinicId) {
          throw new ConflictError(
            `Este CNPJ já está cadastrado em outra empresa. Em caso de dúvidas, entre em contato com ${supportContactText()}.`,
          )
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
    if (!clinic) throw new NotFoundError('Clinic')
    return this.repo.setBusinessHours(clinicId, dto.hours)
  }

  async getPaymentMethodConfig(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')

    const config = await this.repo.findPaymentMethodConfig(clinicId)
    return normalizePaymentMethodConfig(config)
  }

  async updatePaymentMethodConfig(clinicId: string, dto: UpdatePaymentMethodConfigDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')

    if (!dto.pixEnabled && !dto.boletoEnabled && !dto.cardEnabled) {
      throw new AppError('Ative ao menos uma forma de pagamento.', 422, 'PAYMENT_METHOD_REQUIRED')
    }

    if (dto.duplicataEnabled && !dto.pixEnabled && !dto.boletoEnabled) {
      throw new AppError(
        'Duplicata só pode ser ativada quando PIX ou boleto estiverem habilitados.',
        422,
        'DUPLICATA_REQUIRES_PIX_OR_BOLETO',
      )
    }

    if (dto.installmentsEnabled && !dto.cardEnabled) {
      throw new AppError(
        'Parcelamento só pode ser ativado quando o cartão estiver habilitado.',
        422,
        'INSTALLMENTS_REQUIRES_CARD',
      )
    }

    const config = normalizePaymentMethodConfig(dto)
    return this.repo.upsertPaymentMethodConfig(clinicId, config)
  }

  private async lookupBrasilApi(
    cnpj: string,
  ): Promise<Record<string, unknown> | 'not_found' | null> {
    // TODO: A BrasilAPI confirma apenas dados públicos do CNPJ, não a titularidade da empresa.
    try {
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`)
      if (response.status === 404) return 'not_found'
      if (!response.ok) {
        logger.warn(
          { cnpj, status: response.status },
          'BrasilAPI indisponível durante consulta de CNPJ',
        )
        return null
      }

      const data = (await response.json()) as Record<string, unknown>
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

  async getSmtpSettings(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    return {
      smtpHost: clinic.smtpHost ?? null,
      smtpPort: clinic.smtpPort ?? null,
      smtpUser: clinic.smtpUser ?? null,
      smtpFrom: clinic.smtpFrom ?? null,
      smtpSecure: clinic.smtpSecure,
      smtpEnabled: clinic.smtpEnabled,
      configured: !!(clinic.smtpHost && clinic.smtpUser && clinic.smtpPass),
      enabled: clinic.smtpEnabled,
    }
  }

  async updateSmtpSettings(clinicId: string, dto: UpdateSmtpSettingsDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    await this.repo.updateSmtp(clinicId, {
      smtpHost: dto.smtpHost ?? null,
      smtpPort: dto.smtpPort ?? null,
      smtpUser: dto.smtpUser ?? null,
      smtpPass: dto.smtpPass ?? null,
      smtpFrom: dto.smtpFrom ?? null,
      smtpSecure: dto.smtpSecure ?? true,
      smtpEnabled: dto.smtpEnabled ?? true,
    })
    return this.getSmtpSettings(clinicId)
  }

  async testSmtpSettings(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    if (!clinic.smtpHost || !clinic.smtpUser || !clinic.smtpPass) {
      throw new AppError('Configure o servidor SMTP antes de testar.', 400, 'SMTP_NOT_CONFIGURED')
    }
    const nodemailer = await import('nodemailer')
    const { resolve4 } = await import('node:dns/promises')
    // Resolve para IPv4 explícito — evita ENETUNREACH quando o servidor retorna endereço IPv6
    let smtpHost = clinic.smtpHost
    try { const [ipv4] = await resolve4(clinic.smtpHost); smtpHost = ipv4 } catch { /* usa hostname original */ }
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: clinic.smtpPort ?? (clinic.smtpSecure ? 465 : 587),
      secure: clinic.smtpSecure,
      auth: { user: clinic.smtpUser, pass: clinic.smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 10_000,
    })
    try {
      // Race: verify vs. timeout de 12s para evitar hang no frontend
      await Promise.race([
        transporter.verify(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout ao conectar ao servidor SMTP. Verifique o host, porta e firewall.')), 12_000)
        ),
      ])
      return { ok: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      throw new AppError(`Falha na conexão SMTP: ${msg}`, 400, 'SMTP_TEST_FAILED')
    } finally {
      transporter.close()
    }
  }

  // ─── WhatsApp por clínica ──────────────────────────────────────────────────

  private evolutionHeaders() {
    const { evolutionApiKey } = appConfig.whatsapp
    return { 'Content-Type': 'application/json', 'apikey': evolutionApiKey ?? '' }
  }

  async getWhatsappSettings(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')

    const instance = clinic.whatsappInstance ?? null
    if (!instance) return { instance: null, connected: false, configured: false }

    const { evolutionUrl } = appConfig.whatsapp
    if (!evolutionUrl) return { instance, connected: false, configured: true }

    try {
      const res = await fetch(`${evolutionUrl}/instance/connectionState/${instance}`, {
        headers: this.evolutionHeaders(),
      })
      if (!res.ok) return { instance, connected: false, configured: true }
      const data = (await res.json()) as { instance?: { state?: string } }
      const connected = data?.instance?.state === 'open'
      return { instance, connected, configured: true }
    } catch {
      return { instance, connected: false, configured: true }
    }
  }

  async updateWhatsappInstance(clinicId: string, dto: UpdateWhatsappSettingsDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    await this.repo.updateWhatsapp(clinicId, { whatsappInstance: dto.whatsappInstance ?? null })
    return this.getWhatsappSettings(clinicId)
  }

  async getWhatsappQrCode(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    if (!clinic.whatsappInstance) {
      throw new AppError('Configure o nome da instância antes de escanear o QR Code.', 400, 'WHATSAPP_INSTANCE_NOT_SET')
    }

    const { evolutionUrl } = appConfig.whatsapp
    if (!evolutionUrl) {
      throw new AppError('Evolution API não configurada no servidor.', 503, 'EVOLUTION_NOT_CONFIGURED')
    }

    // Garante que a instância existe na Evolution API
    const createRes = await fetch(`${evolutionUrl}/instance/create`, {
      method: 'POST',
      headers: this.evolutionHeaders(),
      body: JSON.stringify({ instanceName: clinic.whatsappInstance, qrcode: true, integration: 'WHATSAPP-BAILEYS' }),
    })
    if (!createRes.ok && createRes.status !== 409) {
      // 409 = instância já existe, pode continuar
      const txt = await createRes.text()
      throw new AppError(`Falha ao criar instância: ${txt}`, 502, 'EVOLUTION_CREATE_FAILED')
    }

    // Conecta e obtém o QR code
    const connectRes = await fetch(`${evolutionUrl}/instance/connect/${clinic.whatsappInstance}`, {
      headers: this.evolutionHeaders(),
    })
    if (!connectRes.ok) {
      const txt = await connectRes.text()
      throw new AppError(`Falha ao obter QR Code: ${txt}`, 502, 'EVOLUTION_CONNECT_FAILED')
    }
    const data = (await connectRes.json()) as { base64?: string; code?: string }
    return { base64: data.base64 ?? null, code: data.code ?? null }
  }

  async disconnectWhatsapp(clinicId: string) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic')
    if (!clinic.whatsappInstance) return { ok: true }

    const { evolutionUrl } = appConfig.whatsapp
    if (evolutionUrl) {
      await fetch(`${evolutionUrl}/instance/logout/${clinic.whatsappInstance}`, {
        method: 'DELETE',
        headers: this.evolutionHeaders(),
      }).catch(() => { /* ignora erros de desconexão */ })
    }
    return { ok: true }
  }
}
