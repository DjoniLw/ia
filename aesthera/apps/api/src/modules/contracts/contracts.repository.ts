import { prisma } from '../../database/prisma/client'
import type {
  CreateContractTemplateDto,
  CreateCustomerContractDto,
  UpdateContractTemplateDto,
} from './contracts.dto'

export class ContractsRepository {
  // ── Templates ────────────────────────────────────────────────────────────────

  async findAllTemplates(clinicId: string) {
    return prisma.contractTemplate.findMany({
      where: { clinicId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findTemplateById(clinicId: string, id: string) {
    return prisma.contractTemplate.findFirst({ where: { id, clinicId } })
  }

  async createTemplate(clinicId: string, dto: CreateContractTemplateDto) {
    return prisma.contractTemplate.create({
      data: {
        clinicId,
        name: dto.name,
        description: dto.description,
        storageKey: dto.storageKey,
      },
    })
  }

  async updateTemplate(clinicId: string, id: string, dto: UpdateContractTemplateDto) {
    return prisma.contractTemplate.update({
      where: { id, clinicId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.storageKey !== undefined && { storageKey: dto.storageKey }),
        ...(dto.active !== undefined && { active: dto.active }),
      },
    })
  }

  async deleteTemplate(clinicId: string, id: string) {
    return prisma.contractTemplate.delete({ where: { id, clinicId } })
  }

  // ── Customer Contracts ────────────────────────────────────────────────────────

  async findContractsByCustomer(clinicId: string, customerId: string) {
    return prisma.customerContract.findMany({
      where: { clinicId, customerId, deletedAt: null },
      include: { template: { select: { name: true, storageKey: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findContractById(clinicId: string, id: string) {
    return prisma.customerContract.findFirst({
      where: { id, clinicId, deletedAt: null },
      include: { template: { select: { name: true, storageKey: true } } },
    })
  }

  async createContract(
    clinicId: string,
    customerId: string,
    dto: CreateCustomerContractDto,
  ) {
    return prisma.customerContract.create({
      data: {
        clinicId,
        customerId,
        templateId: dto.templateId,
      },
      include: { template: { select: { name: true, storageKey: true } } },
    })
  }

  async updateContract(clinicId: string, id: string, data: Parameters<typeof prisma.customerContract.update>[0]['data']) {
    return prisma.customerContract.update({ where: { id, clinicId }, data })
  }

  async softDeleteContract(id: string) {
    return prisma.customerContract.update({
      where: { id },
      data: { deletedAt: new Date() },
    })
  }
}
