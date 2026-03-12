import { NotFoundError } from '../../shared/errors/app-error'
import type { SetBusinessHoursDto, UpdateClinicDto } from './clinics.dto'
import { ClinicsRepository } from './clinics.repository'

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
    return this.repo.update(clinicId, data)
  }

  async getBusinessHours(clinicId: string) {
    return this.repo.getBusinessHours(clinicId)
  }

  async setBusinessHours(clinicId: string, dto: SetBusinessHoursDto) {
    const clinic = await this.repo.findById(clinicId)
    if (!clinic) throw new NotFoundError('Clinic not found')
    return this.repo.setBusinessHours(clinicId, dto.hours)
  }
}
