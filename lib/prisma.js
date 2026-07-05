import { PrismaClient } from '../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const globalForPrisma = globalThis

function parseDbUrl(url) {
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
  }
}

function crearPrisma() {
  const dbConfig = parseDbUrl(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb(dbConfig)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? crearPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
