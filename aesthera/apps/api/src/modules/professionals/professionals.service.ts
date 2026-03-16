import { ConflictError, NotFoundError } from '../../shared/errors/app-error'
import type {
  AssignServicesDto,
  CreateProfessionalDto,
  ListProfessionalsQuery,
  SetWorkingHoursDto,
  UpdateProfessionalDto,
} from './professionals.dto'
import { ProfessionalsRepository } from './professionals.repository'

export class ProfessionalsService {
  private repo = new ProfessionalsRepository()

  async list(clinicId: string, q: ListProfessionalsQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const p = await this.repo.findById(clinicId, id)
    if (!p) throw new NotFoundError('Professional not found')
    return p
  }

  async create(clinicId: string, dto: CreateProfessionalDto) {
    const existing = await this.repo.findByEmail(clinicId, dto.email)
    if (existing) throw new ConflictError('A professional with this email already exists')
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdateProfessionalDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  async delete(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await this.repo.softDelete(clinicId, id)
    return { message: 'Professional deleted' }
  }

  async getWorkingHours(clinicId: string, id: string) {
    await this.get(clinicId, id)
    return this.repo.getWorkingHours(clinicId, id)
  }

  async setWorkingHours(clinicId: string, id: string, dto: SetWorkingHoursDto) {
    await this.get(clinicId, id)
    return this.repo.setWorkingHours(clinicId, id, dto.hours)
  }

  async getServices(clinicId: string, id: string) {
    await this.get(clinicId, id)
    return this.repo.getServices(clinicId, id)
  }

  async assignServices(clinicId: string, id: string, dto: AssignServicesDto) {
    await this.get(clinicId, id)
    await this.repo.assignServices(clinicId, id, dto.serviceIds, dto.allServices)
    return this.repo.getServices(clinicId, id)
  }
}
