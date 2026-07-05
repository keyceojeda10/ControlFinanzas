const { PrismaClient } = require('@prisma/client')
const { PrismaMariaDb } = require('@prisma/adapter-mariadb')

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
  require('dotenv').config()
  const dbConfig = parseDbUrl(process.env.DATABASE_URL)
  const adapter = new PrismaMariaDb(dbConfig)
  return new PrismaClient({ adapter })
}

module.exports = { crearPrisma, PrismaClient }
