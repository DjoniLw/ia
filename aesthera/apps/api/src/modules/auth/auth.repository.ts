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

  findClinicById(id: string) {
    return prisma.clinic.findUnique({
      where: { id },
      select: { id: true, slug: true, emailVerified: true },
    })
  }

  findClinicByEmail(email: string) {
    return prisma.clinic.findUnique({
      where: { email },
      select: { id: true, slug: true, name: true, emailVerified: true },
    })
  }

  findClinicByVerificationToken(token: string) {
    return prisma.clinic.findUnique({
      where: { emailVerificationToken: token },
      select: {
        id: true,
        slug: true,
        emailVerified: true,
        emailVerificationExpiresAt: true,
      },
    })
  }

  verifyClinicEmail(clinicId: string) {
    return prisma.clinic.update({
      where: { id: clinicId },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiresAt: null,
      },
      select: { id: true, slug: true },
    })
  }

  createClinicWithAdmin(data: {
    clinicId: string
    slug: string
    name: string
    email: string
    phone?: string
    document?: string
    adminId: string
    adminName: string
    adminEmail: string
    passwordHash: string
    emailVerificationToken: string
    emailVerificationExpiresAt: Date
  }) {
    return prisma.clinic.create({
      data: {
        id: data.clinicId,
        slug: data.slug,
        name: data.name,
        email: data.email,
        phone: data.phone,
        document: data.document,
        emailVerified: false,
        emailVerificationToken: data.emailVerificationToken,
        emailVerificationExpiresAt: data.emailVerificationExpiresAt,
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

  /** Re-use an existing unverified clinic record: refresh the token and update mutable fields. */
  async updateUnverifiedClinicForReRegistration(data: {
    clinicId: string
    name: string
    phone?: string
    document?: string
    adminName: string
    passwordHash: string
    emailVerificationToken: string
    emailVerificationExpiresAt: Date
  }) {
    const [clinic] = await prisma.$transaction([
      prisma.clinic.update({
        where: { id: data.clinicId },
        data: {
          name: data.name,
          phone: data.phone,
          document: data.document,
          emailVerificationToken: data.emailVerificationToken,
          emailVerificationExpiresAt: data.emailVerificationExpiresAt,
        },
        select: { id: true, slug: true, name: true, email: true, plan: true, status: true },
      }),
      prisma.user.updateMany({
        where: { clinicId: data.clinicId, role: 'admin' },
        data: { name: data.adminName, passwordHash: data.passwordHash },
      }),
    ])
    return clinic
  }

  updateClinicVerificationToken(
    clinicId: string,
    token: string,
    expiresAt: Date,
  ) {
    return prisma.clinic.update({
      where: { id: clinicId },
      data: {
        emailVerificationToken: token,
        emailVerificationExpiresAt: expiresAt,
      },
      select: { id: true, slug: true, name: true },
    })
  }

  findAdminUserByClinic(clinicId: string) {
    return prisma.user.findFirst({
      where: { clinicId, role: 'admin', active: true },
      select: { id: true, clinicId: true, role: true },
    })
  }

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
