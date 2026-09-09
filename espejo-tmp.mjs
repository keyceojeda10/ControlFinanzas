import { PrismaClient } from '@prisma/client'
const p = new PrismaClient()
const o = await p.organization.findUnique({ where: { id: 'zzvideodemo000000000000org' }, select: { id: true, plan: true } })
console.log('ANTES:', JSON.stringify(o))
if (process.argv[2]) {
  await p.organization.update({ where: { id: 'zzvideodemo000000000000org' }, data: { plan: process.argv[2] } })
  console.log('AHORA:', process.argv[2])
}
await p.$disconnect()
