const { PrismaClient } = require('../generated/prisma/client')
const { PrismaMariaDb } = require('@prisma/adapter-mariadb')

function crearPrisma() {
  require('dotenv').config()
  const adapter = new PrismaMariaDb({
    connectionString: process.env.DATABASE_URL,
  })
  return new PrismaClient({ adapter })
}

module.exports = { crearPrisma, PrismaClient }
