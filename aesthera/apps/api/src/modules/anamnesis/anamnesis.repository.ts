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
      // SEC2: select explícito — signToken, signatureUrl, consentText, ipAddress, userAgent NUNCA retornados
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
        customer: { select: { id: true, name: true, phone: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        clinicalRecord: { select: { id: true } },
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
        signatureUrl: true, // exposto para painel da clínica — endpoint autenticado
        consentGivenAt: true,
        signedAt: true,
        expiresAt: true,
        tokenExpiresAt: true,
        createdAt: true,
        updatedAt: true,
        // SEC2: signToken, consentText, ipAddress, userAgent NUNCA retornados
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

  /** Atualiza o status garantindo multi-tenancy. Lança NotFoundError se não encontrado ou clínica errada. */
  async updateStatus(clinicId: string, id: string, status: string) {
    // Verificação de ownership: findFirst com clinicId antes de update
    const existing = await prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    return prisma.anamnesisRequest.update({
      where: { id },
      data: { status: status as never },
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
        tokenExpiresAt: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })
  }

  /** Atualiza respostas da clínica — apenas para fichas clinic_filled (validado no service). */
  async updateStaffAnswers(clinicId: string, id: string, staffAnswers: Record<string, unknown>) {
    const result = await prisma.anamnesisRequest.updateMany({
      where: { id, clinicId, deletedAt: null },
      data: { staffAnswers: staffAnswers as Prisma.InputJsonValue },
    })
    if (result.count === 0) throw new NotFoundError('AnamnesisRequest')
    return prisma.anamnesisRequest.findFirst({
      where: { id, clinicId },
      select: {
        id: true,
        clinicId: true,
        customerId: true,
        mode: true,
        status: true,
        groupId: true,
        groupName: true,
        staffAnswers: true,
        diffResolution: true,
        updatedAt: true,
        customer: { select: { id: true, name: true } },
        createdBy: { select: { id: true, name: true } },
      },
    })
  }

  /** Persiste signToken + consentText e transiciona para sent_to_client. */
  async setSignToken(clinicId: string, id: string, signToken: string, expiresAt: Date, consentText: string) {
    // Verificação de ownership — evita IDOR cross-tenant
    const existing = await prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
      select: { id: true },
    })
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    return prisma.anamnesisRequest.update({
      where: { id },
      data: {
        signToken,
        expiresAt,
        tokenExpiresAt: expiresAt,
        consentText,
        status: 'sent_to_client',
      },
      // SEC2: signToken NUNCA retornado — usar a variável local no service para notificações
      select: {
        id: true,
        clinicId: true,
        status: true,
        groupName: true,
        expiresAt: true,
        customer: { select: { id: true, name: true, phone: true, email: true } },
      },
    })
  }

  async cancel(clinicId: string, id: string) {
    const existing = await prisma.anamnesisRequest.findFirst({
      where: { id, clinicId, deletedAt: null },
    })
    if (!existing) throw new NotFoundError('AnamnesisRequest')
    const cancellableStatuses = ['pending', 'draft', 'clinic_filled', 'sent_to_client', 'correction_requested']
    if (!cancellableStatuses.includes(existing.status)) {
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
      // SEC2: select explícito — signToken, signatureUrl, consentText, ipAddress, userAgent NUNCA retornados
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
        tokenExpiresAt: true,
        signedAt: true,
        createdAt: true,
        updatedAt: true,
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
      signatureUrl: string
      signatureHash: string
      consentText: string
      consentGivenAt: Date
      signedAt: Date
      ipAddress: string | null
      userAgent: string | null
      status: 'client_submitted' | 'signed'
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
        signatureUrl: data.signatureUrl,
        signatureHash: data.signatureHash,
        consentText: data.consentText,
        consentGivenAt: data.consentGivenAt,
        signedAt: data.signedAt,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        status: data.status,
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
