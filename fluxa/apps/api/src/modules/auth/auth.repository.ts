import { Company, CompanyAuth } from '@prisma/client'
import { prisma } from '../../database/prisma/client'

export const authRepository = {
  async findCompanyByEmail(email: string): Promise<(Company & { auth: CompanyAuth | null }) | null> {
    return prisma.company.findUnique({
      where: { email },
      include: { auth: true },
    })
  },

  async findCompanyById(id: string): Promise<Company | null> {
    return prisma.company.findUnique({ where: { id } })
  },

  async createCompanyWithAuth(data: {
    name: string
    email: string
    document: string
    passwordHash: string
  }): Promise<Company> {
    return prisma.company.create({
      data: {
        name: data.name,
        email: data.email,
        document: data.document,
        auth: {
          create: { passwordHash: data.passwordHash },
        },
      },
    })
  },

  async updateFailedAttempts(companyId: string, attempts: number, lockedUntil: Date | null) {
    return prisma.companyAuth.update({
      where: { companyId },
      data: { failedAttempts: attempts, lockedUntil },
    })
  },

  async resetFailedAttempts(companyId: string) {
    return prisma.companyAuth.update({
      where: { companyId },
      data: { failedAttempts: 0, lockedUntil: null },
    })
  },
}
