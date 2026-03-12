import { prisma } from '../../database/prisma/client'

export class AuthRepository {
  // ─── User queries ──────────────────────────────────────────────────────────

  findUserByEmail(clinicId: string, email: string) {
    return prisma.user.findUnique({
      where: { clinicId_email: { clinicId, email } },
      select: {
        id: true,
        clinicId: true,
        name: true,
        email: true,
        passwordHash: true,
        role: true,
        active: true,
      },
    })
  }

  incrementUserFailedAttempts(_userId: string) {
    // Tracked in Redis (see AuthService) — no DB column for users
    return Promise.resolve()
  }

  updateUserLastLogin(userId: string) {
    return prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    })
  }

  // ─── Clinic queries ────────────────────────────────────────────────────────

  findClinicBySlug(slug: string) {
    return prisma.clinic.findUnique({
      where: { slug },
      select: { id: true, status: true, emailVerified: true },
    })
  }

  findClinicByEmail(email: string) {
    return prisma.clinic.findUnique({
      where: { email },
      select: { id: true },
    })
  }

  createClinicWithAdmin(data: {
    clinicId: string
    slug: string
    name: string
    email: string
    document?: string
    adminId: string
    adminName: string
    adminEmail: string
    passwordHash: string
  }) {
    return prisma.clinic.create({
      data: {
        id: data.clinicId,
        slug: data.slug,
        name: data.name,
        email: data.email,
        document: data.document,
        emailVerified: true, // Phase 1: skip email verification flow
        users: {
          create: {
            id: data.adminId,
            name: data.adminName,
            email: data.adminEmail,
            passwordHash: data.passwordHash,
            role: 'admin',
          },
        },
      },
      select: {
        id: true,
        slug: true,
        name: true,
        email: true,
        plan: true,
        status: true,
      },
    })
  }

  // ─── Professional auth ─────────────────────────────────────────────────────

  findProfessionalByEmail(clinicId: string, email: string) {
    return prisma.professional.findUnique({
      where: { clinicId_email: { clinicId, email } },
      select: {
        id: true,
        clinicId: true,
        name: true,
        email: true,
        active: true,
        auth: {
          select: {
            passwordHash: true,
            failedAttempts: true,
            lockedUntil: true,
          },
        },
      },
    })
  }
}

export const authRepository = new AuthRepository()
