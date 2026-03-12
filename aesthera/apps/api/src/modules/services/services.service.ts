import { NotFoundError } from '../../shared/errors/app-error'
import type { CreateServiceDto, ListServicesQuery, UpdateServiceDto } from './services.dto'
import { ServicesRepository } from './services.repository'

export class ServicesService {
  private repo = new ServicesRepository()

  async list(clinicId: string, q: ListServicesQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const service = await this.repo.findById(clinicId, id)
    if (!service) throw new NotFoundError('Service not found')
    return service
  }

  async create(clinicId: string, dto: CreateServiceDto) {
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdateServiceDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  async delete(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await this.repo.softDelete(clinicId, id)
    return { message: 'Service deleted' }
  }
}
