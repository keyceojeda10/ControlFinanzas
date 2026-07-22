const { PrismaClient } = require('@prisma/client')
const p = new PrismaClient()

async function run() {
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
}
run()
