import { prisma } from '../../database/prisma/client'
import type { ListNotificationsQuery } from './notifications.dto'

export class NotificationsRepository {
  async findAll(clinicId: string, q: ListNotificationsQuery) {
    const where: Record<string, unknown> = { clinicId }
    if (q.status) where.status = q.status
    if (q.channel) where.type = q.channel
    if (q.event) where.event = q.event
    if (q.customerId) where.customerId = q.customerId
    if (q.billingId) where.billingId = q.billingId
    if (q.appointmentId) where.appointmentId = q.appointmentId

    const skip = (q.page - 1) * q.limit
    const [items, total] = await Promise.all([
      prisma.notificationLog.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: q.limit,
      }),
      prisma.notificationLog.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.notificationLog.findFirst({
      where: { id, clinicId },
      include: {
        customer: { select: { id: true, name: true, email: true, phone: true } },
      },
    })
  }

  async create(data: {
    clinicId: string
    type: 'whatsapp' | 'email'
    channel: string
    event: string
    payload: object
    appointmentId?: string
    billingId?: string
    customerId?: string
  }) {
    return prisma.notificationLog.create({
      data: {
        ...data,
        payload: data.payload as never,
        status: 'pending',
        attempts: 0,
      },
    })
  }

  async markSent(id: string) {
    return prisma.notificationLog.update({
      where: { id },
      data: { status: 'sent', lastAttemptAt: new Date() },
    })
  }

  async markFailed(id: string, error: string, attempts: number) {
    return prisma.notificationLog.update({
      where: { id },
      data: { status: 'failed', error, attempts, lastAttemptAt: new Date() },
    })
  }

  async resetForRetry(id: string) {
    return prisma.notificationLog.update({
      where: { id },
      data: { status: 'pending', error: null },
    })
  }
}
