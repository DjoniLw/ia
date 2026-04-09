import { Prisma } from '@prisma/client'
import { prisma } from '../../database/prisma/client'
import { NotFoundError } from '../../shared/errors/app-error'
import type {
  CreateAnamnesisRequestDto,
  ListAnamnesisRequestsQuery,
} from './anamnesis.dto'

export class AnamnesisRepository {
  async create(
    clinicId: string,
    createdByUserId: string,
    data: CreateAnamnesisRequestDto & { signToken: string; expiresAt: Date },
  ) {
    return prisma.anamnesisRequest.create({
      data: {
        clinicId,
        customerId: data.customerId,
        createdByUserId,
        mode: data.mode,
        groupId: data.groupId,
        groupName: data.groupName,
        questionsSnapshot: data.questionsSnapshot as Prisma.InputJsonValue,
        staffAnswers: data.staffAnswers != null ? (data.staffAnswers as Prisma.InputJsonValue) : Prisma.JsonNull,
        signToken: data.signToken,
        expiresAt: data.expiresAt,
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  async findAll(clinicId: string, q: ListAnamnesisRequestsQuery) {
    const skip = (q.page - 1) * q.limit
    const where = {
      clinicId,
      deletedAt: null,
      ...(q.customerId && { customerId: q.customerId }),
      ...(q.status && { status: q.status }),
    }
    const [items, total] = await Promise.all([
      prisma.anamnesisRequest.findMany({
        where,
        skip,
        take: q.limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          clinicId: true,
          customerId: true,
          createdByUserId: true,
          mode: true,
          status: true,
          groupId: true,
          groupName: true,
          expiresAt: true,
          signedAt: true,
          createdAt: true,
          customer: { select: { id: true, name: true } },
          createdBy: { select: { id: true, name: true } },
          clinicalRecord: { select: { id: true } },
        },
      }),
      prisma.anamnesisRequest.count({ where }),
    ])
    return { items, total, page: q.page, limit: q.limit }
  }

  async findById(clinicId: string, id: string) {
    return prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: {
        id: true,
        clinicId: true,
        customerId: true,
        createdByUserId: true,
        mode: true,
        status: true,
        groupId: true,
        groupName: true,
        questionsSnapshot: true,
        staffAnswers: true,
        clientAnswers: true,
        diffResolution: true,
        signatureHash: true,
        consentGivenAt: true,
        signedAt: true,
        expiresAt: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        // SEC2: signToken, signatureUrl, consentText, ipAddress, userAgent NUNCA retornados
        customer: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        clinicalRecord: { select: { id: true } },
      },
    })
  }

  /** Busca com dados da clínica — usado pelo sendToClient para gerar consentText server-side. */
  async findByIdWithClinic(clinicId: string, id: string) {
    return prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: {
        id: true,
        clinicId: true,
        status: true,
        groupName: true,
        // SEC2: signToken nunca retornado
        customer: { select: { id: true, name: true, phone: true, email: true } },
        clinic: { select: { id: true, name: true, document: true } },
      },
    })
  }

  /** Busca pelo token público. Não filtra por clinicId pois o token é único. */
  async findByToken(signToken: string) {
    return prisma.anamnesisRequest.findUnique({
      where: { signToken },
      include: {
        customer: { select: { id: true, name: true } },
        clinic: { select: { id: true, name: true, slug: true, document: true } },
      },
    })
  }

  async markExpired(clinicId: string, id: string) {
    return prisma.anamnesisRequest.updateMany({
      where: { id, clinicId, status: { in: ['pending', 'sent_to_client'] } },
      data: { status: 'expired' },
    })
  }

  async updateStatus(_clinicId: string, id: string, status: string) {
    return prisma.anamnesisRequest.update({
      where: { id },
      data: { status: status as never },
    })
  }

  /** Persiste signToken + consentText e transiciona para sent_to_client. */
  async setSignToken(_clinicId: string, id: string, signToken: string, expiresAt: Date, consentText: string) {
    return prisma.anamnesisRequest.update({
      where: { id },
      data: {
        signToken,
        expiresAt,
        tokenExpiresAt: expiresAt,
        consentText,
        status: 'sent_to_client',
      },
      select: {
        id: true,
        clinicId: true,
        status: true,
        groupName: true,
        expiresAt: true,
        // SEC2: signToken retornado aqui para envio de notificação — não exposto na API
        signToken: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    })
  }

  async cancel(clinicId: string, id: string) {
    const existing = await prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    if (!['pending', 'correction_requested'].includes(existing.status)) {
      return existing
    }
    return prisma.anamnesisRequest.update({
      where: { id },
      data: { status: 'cancelled' },
    })
  }

  async resend(
    clinicId: string,
    id: string,
    newToken: string,
    expiresAt: Date,
  ) {
    const existing = await prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    return prisma.anamnesisRequest.update({
      where: { id },
      data: {
        signToken: newToken,
        expiresAt,
        status: 'pending',
      },
      include: {
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    })
  }

  /**
   * Submete a assinatura usando updateMany para proteger contra race conditions.
   * Retorna o count de rows afetadas; 0 significa que o status já mudou.
   */
  async submitSignature(
    signToken: string,
    data: {
      clientAnswers: Record<string, unknown>
      signatureBase64: string
      signatureHash: string
      consentText: string
      consentGivenAt: Date
      signedAt: Date
      ipAddress: string | null
      userAgent: string | null
    },
  ) {
    const result = await prisma.anamnesisRequest.updateMany({
      where: {
        signToken,
        status: { in: ['pending', 'sent_to_client', 'correction_requested'] },
        expiresAt: { gt: new Date() },
      },
      data: {
        clientAnswers: data.clientAnswers as Prisma.InputJsonValue,
        signatureUrl: data.signatureBase64,
        signatureHash: data.signatureHash,
        consentText: data.consentText,
        consentGivenAt: data.consentGivenAt,
        signedAt: data.signedAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: 'client_submitted',
      },
    })
    return result.count
  }

  async requestCorrection(signToken: string) {
    return prisma.anamnesisRequest.updateMany({
      where: { signToken, status: { in: ['pending', 'sent_to_client'] }, expiresAt: { gt: new Date() } },
      data: { status: 'correction_requested' },
    })
  }
}
