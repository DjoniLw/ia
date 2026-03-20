import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { appConfig } from '../../config/app.config'
import { companyConfig } from '../../config/company.config'
import { redis } from '../../database/redis/client'
import { logger } from '../../shared/logger/logger'
import { buildTransferEmailHtml } from '../../shared/utils/transfer-email'
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from '../../shared/errors/app-error'
import { NotificationsService } from '../notifications/notifications.service'
import type {
  AcceptInviteDto,
  InviteUserDto,
  UpdateMeDto,
  UpdateUserDto,
} from './users.dto'
import { UsersRepository } from './users.repository'

const INVITE_TTL_HOURS = 48
const BCRYPT_COST = 12

export class UsersService {
  private repo = new UsersRepository()
  private notifications = new NotificationsService()

  async listUsers(clinicId: string) {
    return this.repo.findAll(clinicId)
  }

  async getUser(clinicId: string, userId: string) {
    const user = await this.repo.findById(clinicId, userId)
    if (!user) throw new NotFoundError('User not found')
    return user
  }

  async getMe(clinicId: string, userId: string) {
    return this.getUser(clinicId, userId)
  }

  async inviteUser(clinicId: string, dto: InviteUserDto) {
    const existing = await this.repo.findByEmail(clinicId, dto.email)
    if (existing) throw new ConflictError('A user with this email already exists in this clinic')

    if (appConfig.isProduction) {
      const sourceMembership = await this.repo.findActiveMembershipInOtherClinic(dto.email, clinicId)
      if (sourceMembership?.passwordHash) {
        const targetClinic = await this.repo.findClinicById(clinicId)
        const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)
        const pendingUser = await this.repo.create({
          clinicId,
          name: dto.name,
          email: dto.email,
          role: dto.role,
          inviteToken: null,
          inviteExpiresAt: expiresAt,
        })

        const transferToken = crypto.randomUUID()
        await this.repo.createTransferToken({
          token: transferToken,
          email: dto.email,
          sourceClinicId: sourceMembership.clinicId,
          sourceUserId: sourceMembership.id,
          targetClinicId: clinicId,
          targetUserId: pendingUser.id,
          role: dto.role,
          expiresAt,
        })

        await this.sendTransferEmail({
          clinicId,
          email: dto.email,
          sourceClinicName: sourceMembership.clinic.name,
          targetClinicName: targetClinic?.name ?? 'nova empresa',
          token: transferToken,
        })

        return {
          id: pendingUser.id,
          email: pendingUser.email,
          role: pendingUser.role,
          transferPending: true as const,
          message: 'Solicitação de transferência enviada por e-mail.',
        }
      }
    }

    const rawToken = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex')
    const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000)

    const user = await this.repo.create({
      clinicId,
      name: dto.name,
      email: dto.email,
      role: dto.role,
      inviteToken: tokenHash,
      inviteExpiresAt: expiresAt,
    })

    // Store raw token in Redis for email link — key lookup by token
    await redis.set(`user-invite:${tokenHash}`, user.id, 'EX', INVITE_TTL_HOURS * 3600)

    // TODO: emit InviteUserEvent → Notifications module sends email
    // eventBus.emit('user.invited', { clinicId, userId: user.id, email: dto.email, token: rawToken })

    return { id: user.id, email: user.email, role: user.role, inviteToken: rawToken }
  }

  async acceptInvite(clinicId: string, dto: AcceptInviteDto) {
    const tokenHash = crypto.createHash('sha256').update(dto.token).digest('hex')
    const user = await this.repo.findByInviteToken(clinicId, tokenHash)

    if (!user) throw new NotFoundError('Invite not found')
    if (!user.inviteExpiresAt || user.inviteExpiresAt < new Date()) {
      throw new UnauthorizedError('Invite has expired')
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_COST)
    await this.repo.acceptInvite(user.id, passwordHash)
    await redis.del(`user-invite:${tokenHash}`)

    return { message: 'Invite accepted. You can now log in.' }
  }

  async updateUser(clinicId: string, targetUserId: string, dto: UpdateUserDto) {
    const user = await this.repo.findById(clinicId, targetUserId)
    if (!user) throw new NotFoundError('User not found')

    // Cannot downgrade the last admin
    if (dto.role === 'staff' && user.role === 'admin') {
      const adminCount = await this.repo.countAdmins(clinicId)
      if (adminCount <= 1) throw new ForbiddenError('Cannot downgrade the last admin')
    }

    return this.repo.update(clinicId, targetUserId, dto)
  }

  async updateMe(userId: string, dto: UpdateMeDto) {
    const updates: { name?: string; passwordHash?: string } = {}
    if (dto.name) updates.name = dto.name

    if (dto.newPassword) {
      if (!dto.currentPassword) throw new UnauthorizedError('Current password is required')
      const { prisma } = await import('../../database/prisma/client')
      const fullUser = await prisma.user.findUnique({ where: { id: userId } })
      if (!fullUser?.passwordHash) throw new UnauthorizedError('Password not set')
      const valid = await bcrypt.compare(dto.currentPassword, fullUser.passwordHash)
      if (!valid) throw new UnauthorizedError('Current password is incorrect')
      updates.passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST)
    }

    return this.repo.updateMe(userId, updates)
  }

  async deactivateUser(clinicId: string, targetUserId: string, requesterId: string) {
    if (targetUserId === requesterId) throw new ForbiddenError('Cannot deactivate your own account')

    const user = await this.repo.findById(clinicId, targetUserId)
    if (!user) throw new NotFoundError('User not found')

    if (user.role === 'admin') {
      const adminCount = await this.repo.countAdmins(clinicId)
      if (adminCount <= 1) throw new ForbiddenError('Cannot deactivate the last admin')
    }

    await this.repo.deactivate(clinicId, targetUserId)
    return { message: 'User deactivated' }
  }

  private async sendTransferEmail(params: {
    clinicId: string
    email: string
    sourceClinicName: string
    targetClinicName: string
    token: string
  }) {
    const confirmUrl = `${appConfig.frontendUrl}/transfer/confirm?token=${params.token}&action=confirm`
    const rejectUrl = `${appConfig.frontendUrl}/transfer/confirm?token=${params.token}&action=reject`
    const html = buildTransferEmailHtml({
      sourceClinicName: params.sourceClinicName,
      targetClinicName: params.targetClinicName,
      confirmUrl,
      rejectUrl,
    })

    try {
      await this.notifications.sendEmail({
        clinicId: params.clinicId,
        email: params.email,
        subject: `${companyConfig.name}: confirme a transferência do seu acesso`,
        htmlBody: html,
        event: 'user_transfer_confirmation',
      })
    } catch (error) {
      logger.error({ error, email: params.email }, 'Failed to send user transfer email')
    }
  }
}
