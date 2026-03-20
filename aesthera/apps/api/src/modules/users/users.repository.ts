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
    inviteToken?: string | null
    inviteExpiresAt?: Date | null
  }) {
    // Invited users start as inactive; they become active after accepting the invite.
    return prisma.user.create({ data: { ...data, active: false } })
  }

  async findActiveMembershipInOtherClinic(email: string, currentClinicId: string) {
    return prisma.user.findFirst({
      where: {
        email,
        active: true,
        clinicId: { not: currentClinicId },
        clinic: { status: 'active', emailVerified: true },
      },
      orderBy: [{ lastLoginAt: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        clinicId: true,
        name: true,
        email: true,
        passwordHash: true,
        clinic: { select: { id: true, name: true, slug: true } },
      },
    })
  }

  async findClinicById(clinicId: string) {
    return prisma.clinic.findUnique({
      where: { id: clinicId },
      select: { id: true, name: true, slug: true },
    })
  }

  async createTransferToken(data: {
    token: string
    email: string
    sourceClinicId: string
    sourceUserId: string
    targetClinicId: string
    targetUserId: string
    role: 'admin' | 'staff'
    expiresAt: Date
  }) {
    return prisma.transferToken.create({
      data: {
        ...data,
        kind: 'user_invite',
      },
    })
  }

  async deletePendingUser(userId: string) {
    return prisma.user.delete({ where: { id: userId } })
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
