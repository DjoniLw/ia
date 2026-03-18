import { z } from 'zod'
import { prisma } from '../../database/prisma/client'
import { AppError, NotFoundError } from '../../shared/errors/app-error'

export const CreateRoomDto = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
})
export type CreateRoomDto = z.infer<typeof CreateRoomDto>

export const UpdateRoomDto = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
})
export type UpdateRoomDto = z.infer<typeof UpdateRoomDto>

export class RoomsService {
  async list(clinicId: string) {
    return prisma.room.findMany({
      where: { clinicId },
      orderBy: { name: 'asc' },
    })
  }

  async get(clinicId: string, id: string) {
    const room = await prisma.room.findFirst({ where: { id, clinicId } })
    if (!room) throw new NotFoundError('Room')
    return room
  }

  async create(clinicId: string, dto: CreateRoomDto) {
    const name = dto.name.trim()
    const exists = await prisma.room.findFirst({
      where: { clinicId, name: { equals: name, mode: 'insensitive' } },
    })
    if (exists) throw new AppError('Sala com esse nome já existe', 409, 'ROOM_EXISTS')

    return prisma.room.create({
      data: { clinicId, name, description: dto.description },
    })
  }

  async update(clinicId: string, id: string, dto: UpdateRoomDto) {
    await this.get(clinicId, id)
    return prisma.room.update({ where: { id }, data: dto })
  }

  async remove(clinicId: string, id: string) {
    await this.get(clinicId, id)
    await prisma.room.delete({ where: { id } })
    return { ok: true }
  }
}

export const roomsService = new RoomsService()
