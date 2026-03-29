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

    // Verificar se o cliente possui registros vinculados — impedir remoção caso positivo
    const counts = await prisma.customer.findFirst({
      where: { id, clinicId },
      select: {
        _count: {
          select: {
            appointments: true,
            billing: true,
            payments: true,
            walletEntries: true,
            customerPackages: true,
            productSales: true,
            ledgerEntries: true,
          },
        },
      },
    })

    const total =
      (counts?._count.appointments ?? 0) +
      (counts?._count.billing ?? 0) +
      (counts?._count.payments ?? 0) +
      (counts?._count.walletEntries ?? 0) +
      (counts?._count.customerPackages ?? 0) +
      (counts?._count.productSales ?? 0) +
      (counts?._count.ledgerEntries ?? 0)

    if (total > 0) {
      throw new ConflictError(
        'Não é possível remover o cliente pois ele possui registros vinculados (agendamentos, cobranças, pagamentos, carteira, pacotes ou vendas). Considere inativá-lo.',
      )
    }

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
    await prisma.$transaction(async (tx) => {
      // Verificar existência dentro da transação para garantir atomicidade e isolamento multi-tenant
      const customer = await tx.customer.findFirst({ where: { id: customerId, clinicId } })
      if (!customer) throw new NotFoundError('Customer')

      // Excluir prontuários clínicos (dados de saúde — não podem ser mantidos mesmo anonimizados)
      await tx.clinicalRecord.deleteMany({ where: { customerId, clinicId } })

      // Anonimizar todos os campos PII — where inclui clinicId para reforçar isolamento
      await tx.customer.updateMany({
        where: { id: customerId, clinicId },
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
