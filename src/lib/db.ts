import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error', 'warn'], // never 'query' — query logs leak bound params (emails, hashes)
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db