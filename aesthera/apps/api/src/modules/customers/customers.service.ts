import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { ConflictError, NotFoundError } from '../../shared/errors/app-error'
import { createAuditLog } from '../../shared/audit'
import { prisma } from '../../database/prisma/client'
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

  /**
   * Anonimiza os dados pessoais de um cliente em conformidade com a LGPD Art. 18.
   *
   * Operação atômica (transação Prisma):
   * - Substitui todos os campos PII por valores anônimos
   * - Exclui fisicamente os prontuários clínicos (dados de saúde — categoria especial)
   * - Preserva registros de Appointment e Billing para auditoria fiscal
   */
  async anonymize(
    clinicId: string,
    customerId: string,
    actorId: string,
    ip?: string,
  ): Promise<void> {
    const customer = await this.repo.findById(clinicId, customerId)
    if (!customer) throw new NotFoundError('Cliente não encontrado')

    await prisma.$transaction(async (tx) => {
      // Excluir prontuários clínicos (dados de saúde — não podem ser mantidos mesmo anonimizados)
      await tx.clinicalRecord.deleteMany({ where: { customerId, clinicId } })

      // Anonimizar todos os campos PII do cliente
      await tx.customer.update({
        where: { id: customerId },
        data: {
          name: 'Cliente Anonimizado',
          email: `anon-${randomUUID()}@anonimizado.internal`,
          phone: '00000000000',
          document: null,
          birthDate: null,
          address: Prisma.DbNull,
          notes: null,
          metadata: Prisma.DbNull,
          externalId: null,
        },
      })
    })

    await createAuditLog({
      clinicId,
      userId: actorId,
      action: 'customer.anonymized',
      entityId: customerId,
      ip,
    })
  }
}
