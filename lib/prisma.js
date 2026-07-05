import { PrismaClient } from '../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const globalForPrisma = globalThis

function crearPrisma() {
  const adapter = new PrismaMariaDb({
    connectionString: process.env.DATABASE_URL,
  })

  const client = new PrismaClient({ adapter })

  return client
}

export const prisma = globalForPrisma.prisma ?? crearPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
