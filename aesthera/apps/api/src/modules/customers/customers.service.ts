import { ConflictError, NotFoundError } from '../../shared/errors/app-error'
import type { CreateCustomerDto, ListCustomersQuery, UpdateCustomerDto } from './customers.dto'
import { CustomersRepository } from './customers.repository'

export class CustomersService {
  private repo = new CustomersRepository()

  async list(clinicId: string, q: ListCustomersQuery) {
    return this.repo.findAll(clinicId, q)
  }

  async get(clinicId: string, id: string) {
    const customer = await this.repo.findById(clinicId, id)
    if (!customer) throw new NotFoundError('Customer not found')
    return customer
  }

  async create(clinicId: string, dto: CreateCustomerDto) {
    if (dto.email) {
      const dup = await this.repo.findByEmail(clinicId, dto.email)
      if (dup) throw new ConflictError('A customer with this email already exists')
    }
    if (dto.document) {
      const dup = await this.repo.findByDocument(clinicId, dto.document)
      if (dup) throw new ConflictError('A customer with this document already exists')
    }
    return this.repo.create(clinicId, dto)
  }

  async update(clinicId: string, id: string, dto: UpdateCustomerDto) {
    await this.get(clinicId, id)
    return this.repo.update(clinicId, id, dto)
  }

  async delete(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await this.repo.softDelete(clinicId, id)
    return { message: 'Customer deleted' }
  }
}
