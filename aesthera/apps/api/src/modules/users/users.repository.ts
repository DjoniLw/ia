import { prisma } from '../../database/prisma/client'

export class UsersRepository {
  async findAll(clinicId: string) {
    return prisma.user.findMany({
      where: { clinicId, active: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        inviteExpiresAt: true,
        createdAt: true,
      },
    })
  }

  async findById(clinicId: string, userId: string) {
    return prisma.user.findFirst({
      where: { id: userId, clinicId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    })
  }

  async findByEmail(clinicId: string, email: string) {
    return prisma.user.findFirst({ where: { clinicId, email } })
  }

  async findByInviteToken(clinicId: string, tokenHash: string) {
    return prisma.user.findFirst({
      where: { clinicId, inviteToken: tokenHash, active: false },
    })
  }

  async countAdmins(clinicId: string) {
    return prisma.user.count({
      where: { clinicId, role: 'admin', active: true },
    })
  }

  async create(data: {
    clinicId: string
    name: string
    email: string
    role: 'admin' | 'staff'
    inviteToken: string
    inviteExpiresAt: Date
  }) {
    return prisma.user.create({ data })
  }

  async acceptInvite(userId: string, passwordHash: string) {
    return prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash,
        active: true,
        inviteToken: null,
        inviteExpiresAt: null,
      },
    })
  }

  async update(
    clinicId: string,
    userId: string,
    data: { name?: string; role?: 'admin' | 'staff' },
  ) {
    return prisma.user.update({ where: { id: userId, clinicId }, data })
  }

  async updateMe(userId: string, data: { name?: string; passwordHash?: string }) {
    return prisma.user.update({ where: { id: userId }, data })
  }

  async deactivate(clinicId: string, userId: string) {
    return prisma.user.update({
      where: { id: userId, clinicId },
      data: { active: false },
    })
  }
}
