import { PrismaClient } from '@prisma/client'
import { appConfig } from '../../config/app.config'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: appConfig.isProduction ? ['error', 'warn'] : ['query', 'error', 'warn'],
  })

if (!appConfig.isProduction) {
  globalForPrisma.prisma = prisma
}
