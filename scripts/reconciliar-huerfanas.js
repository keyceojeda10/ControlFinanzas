#!/usr/bin/env node
// scripts/reconciliar-huerfanas.js
// One-off: busca preapprovals en MP que no tienen registro local y los cancela
// para evitar cobros fantasma al usuario. Tambien opcionalmente reimporta los
// que estan authorized (ya pagaron) como suscripciones locales activas.
//
// Uso:
//   node scripts/reconciliar-huerfanas.js --dry                 # solo lista
//   node scripts/reconciliar-huerfanas.js --cancel              # cancela pending huerfanos
//   node scripts/reconciliar-huerfanas.js --import              # importa authorized huerfanos a DB
//   node scripts/reconciliar-huerfanas.js --cancel --import     # ambos
//
// Requiere: MERCADOPAGO_ACCESS_TOKEN en .env

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

const TOKEN = process.env.MERCADOPAGO_ACCESS_TOKEN
if (!TOKEN) {
  console.error('FALTA MERCADOPAGO_ACCESS_TOKEN en env')
  process.exit(1)
}

const args = process.argv.slice(2)
const DRY = args.includes('--dry') || (!args.includes('--cancel') && !args.includes('--import'))
const CANCEL = args.includes('--cancel')
const IMPORT = args.includes('--import')

async function mpSearch(status, offset = 0, limit = 50) {
  const url = `https://api.mercadopago.com/preapproval/search?status=${status}&offset=${offset}&limit=${limit}`
  const res = await fetch(url, { headers: { Authorization: `Bearer ${TOKEN}` } })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`MP search fallo ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function mpCancel(id) {
  const res = await fetch(`https://api.mercadopago.com/preapproval/${id}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'cancelled' }),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`MP cancel fallo ${res.status}: ${txt.slice(0, 200)}`)
  }
  return res.json()
}

async function procesar(status) {
  console.log(`\n=== Buscando preapprovals con status=${status} ===`)
  const huerfanos = []
  let offset = 0
  const limit = 50
  while (true) {
    const data = await mpSearch(status, offset, limit)
    const items = data.results || []
    if (items.length === 0) break
    for (const pa of items) {
      const local = await prisma.suscripcion.findFirst({ where: { preapprovalId: String(pa.id) } })
      if (!local) huerfanos.push(pa)
    }
    if (items.length < limit) break
    offset += limit
  }
  console.log(`Encontrados ${huerfanos.length} huerfanos (status=${status})`)
  return huerfanos
}

async function main() {
  console.log('Modo:', { DRY, CANCEL, IMPORT })

  // Pending huerfanos: cancelar (nunca se autorizaron)
  const pendings = await procesar('pending')
  for (const pa of pendings) {
    const ref = pa.external_reference || '(sin ref)'
    const email = pa.payer_email || '(sin email)'
    const id = pa.id
    console.log(`  pending ${id}  email=${email}  ref=${ref}`)
    if (CANCEL) {
      try {
        await mpCancel(id)
        console.log(`    cancelado en MP`)
      } catch (e) {
        console.error(`    ERROR cancelando: ${e.message}`)
      }
    }
  }

  // Authorized huerfanos: importar a DB como suscripcion activa (ya cobraron!)
  const authorized = await procesar('authorized')
  for (const pa of authorized) {
    const ref = pa.external_reference
    const id = pa.id
    console.log(`  authorized ${id}  email=${pa.payer_email}  ref=${ref}  next_payment=${pa.next_payment_date}`)
    if (!IMPORT) continue
    if (!ref) { console.log(`    sin external_reference, no puedo vincular a org. skip.`); continue }

    // external_reference formato: org_<orgId>
    const orgId = ref.startsWith('org_') ? ref.slice(4) : ref
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    if (!org) { console.log(`    org ${orgId} no existe, skip`); continue }

    const planMeta = pa.reason?.toLowerCase().includes('profesional') ? 'professional'
      : pa.reason?.toLowerCase().includes('standard') ? 'standard'
      : pa.reason?.toLowerCase().includes('basic') ? 'basic'
      : 'basic'

    const freq = pa.auto_recurring?.frequency_type === 'months' ? (pa.auto_recurring?.frequency || 1) : 1
    const monto = pa.auto_recurring?.transaction_amount || 0
    const nextPay = pa.next_payment_date ? new Date(pa.next_payment_date) : new Date()

    try {
      await prisma.suscripcion.create({
        data: {
          organizationId:   orgId,
          plan:             planMeta,
          tipo:             'recurrente',
          estado:           'activa',
          fechaInicio:      new Date(),
          fechaVencimiento: nextPay,
          proximoCobroAt:   nextPay,
          montoCOP:         monto,
          preapprovalId:    String(id),
          mpStatus:         'authorized',
          frecuenciaMeses:  freq,
        },
      })
      await prisma.organization.update({
        where: { id: orgId },
        data: { plan: planMeta, activo: true },
      })
      console.log(`    importado a DB como activa, org actualizada`)
    } catch (e) {
      console.error(`    ERROR importando: ${e.message}`)
    }
  }

  console.log('\nResumen:')
  console.log(`  pending huerfanos:    ${pendings.length}   ${CANCEL ? '(cancelados)' : '(solo listados)'}`)
  console.log(`  authorized huerfanos: ${authorized.length} ${IMPORT ? '(importados)' : '(solo listados)'}`)
}

main()
  .catch((e) => { console.error('FATAL:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
