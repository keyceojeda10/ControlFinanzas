import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '..', '.env')
const envContent = readFileSync(envPath, 'utf8')
for (const line of envContent.split('\n')) {
  const m = line.match(/^([^#=]+)=(.*)$/)
  if (m && !process.env[m[1].trim()]) {
    process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const require = createRequire(import.meta.url)
const { PrismaClient } = require('../node_modules/.prisma/client/default.js')
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

const dbConfig = parseDbUrl(process.env.DATABASE_URL)
const adapter = new PrismaMariaDb(dbConfig)
const p = new PrismaClient({ adapter })

const cols = [
  "ALTER TABLE Cliente ADD COLUMN pinPortal VARCHAR(191) NULL",
  "ALTER TABLE Cliente ADD COLUMN portalActivo BOOLEAN NOT NULL DEFAULT false",
  "ALTER TABLE Cliente ADD COLUMN ultimoAccesoPortal DATETIME(3) NULL",
]

for (const sql of cols) {
  try {
    await p.$executeRawUnsafe(sql)
    console.log('OK:', sql.match(/COLUMN (\w+)/)[1])
  } catch (e) {
    if (e.message.includes('Duplicate')) {
      console.log('EXISTS:', sql.match(/COLUMN (\w+)/)[1])
    } else {
      console.error('ERR:', e.message.slice(0, 80))
    }
  }
}
await p.$disconnect()
console.log('DONE')
