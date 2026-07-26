import { PrismaClient } from '../generated/prisma/client'
import { PrismaMariaDb } from '@prisma/adapter-mariadb'

const globalForPrisma = globalThis

// Tamaño del pool por worker. Son 2 workers de PM2, asi que el total contra MySQL
// es DB_POOL_LIMIT × 2 (max_connections del servidor es 300).
// Antes se descartaba el query string de DATABASE_URL, asi que `connection_limit=100`
// era config MUERTA y el adapter usaba su default de 10 (los "pool timeout ... limit=10"
// del log). Ahora se pasa explicito.
const POOL_LIMIT_DEFAULT = 20

function parseDbUrl(url) {
  const parsed = new URL(url)
  const limiteQuery = Number(parsed.searchParams.get('connection_limit'))
  const limiteEnv = Number(process.env.DB_POOL_LIMIT)
  const connectionLimit = [limiteEnv, limiteQuery, POOL_LIMIT_DEFAULT]
    .find((v) => Number.isFinite(v) && v > 0)
  return {
    host: parsed.hostname,
    port: Number(parsed.port) || 3306,
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: parsed.pathname.slice(1),
    connectionLimit,
  }
}

function crearPrisma() {
  const dbConfig = parseDbUrl(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb(dbConfig)
  return new PrismaClient({ adapter })
}

export const prisma = globalForPrisma.prisma ?? crearPrisma()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
