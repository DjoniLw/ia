import { z } from 'zod'
import { prisma } from '../../database/prisma/client'
import { AppError, NotFoundError } from '../../shared/errors/app-error'

export const CreateEquipmentDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})
export type CreateEquipmentDto = z.infer<typeof CreateEquipmentDto>

export const UpdateEquipmentDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
})
export type UpdateEquipmentDto = z.infer<typeof UpdateEquipmentDto>

export class EquipmentService {
  async list(clinicId: string) {
    return prisma.equipment.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    })
  }

  async get(clinicId: string, id: string) {
    const eq = await prisma.equipment.findFirst({ where: { id, clinicId } })
    if (!eq) throw new NotFoundError('Equipment')
    return eq
  }

  async create(clinicId: string, dto: CreateEquipmentDto) {
    const name = dto.name.trim()
    const exists = await prisma.equipment.findFirst({
      where: { clinicId, name: { equals: name, mode: 'insensitive' } },
    })
    if (exists) throw new AppError('Equipamento com esse nome já existe', 409, 'EQUIPMENT_EXISTS')

    return prisma.equipment.create({
      data: { clinicId, name, description: dto.description },
    })
  }

  async update(clinicId: string, id: string, dto: UpdateEquipmentDto) {
    await this.get(clinicId, id)
    return prisma.equipment.update({ where: { id }, data: dto })
  }

  async remove(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await prisma.equipment.delete({ where: { id } })
    return { ok: true }
  }
}

export const equipmentService = new EquipmentService()
