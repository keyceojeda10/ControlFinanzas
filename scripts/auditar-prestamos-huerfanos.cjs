#!/usr/bin/env node
/**
 * Auditoría / arreglo de préstamos "fantasma": préstamos en estado 'activo' cuyo
 * cliente fue marcado 'eliminado' o 'inactivo'. Esos préstamos descuadran el capital
 * porque el dinero salió pero el cliente quedó fuera de los conteos.
 *
 * Uso:
 *   node scripts/auditar-prestamos-huerfanos.cjs                 -> AUDITORÍA (solo lectura)
 *   node scripts/auditar-prestamos-huerfanos.cjs --org=<orgId>   -> filtrar una organización
 *   node scripts/auditar-prestamos-huerfanos.cjs --fix --org=<orgId>  -> ARREGLAR esa org
 *
 * El --fix cancela cada préstamo huérfano revirtiendo el capital (mismo criterio que el
 * DELETE de préstamo): devuelve al saldo el desembolso no recuperado y revierte los
 * recaudos/descuentos asociados, dentro de transacción. El préstamo queda 'cancelado'
 * (no se borra, para trazabilidad). NO corre --fix global: exige --org para evitar errores.
 */

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { crearPrisma } = require('../lib/prisma-cjs.cjs')
const prisma = crearPrisma()

function parseArgs(argv) {
  const opts = { fix: false, org: null, json: false }
  for (const a of argv) {
    if (a === '--fix') opts.fix = true
    else if (a === '--json') opts.json = true
    else if (a.startsWith('--org=')) opts.org = a.slice('--org='.length)
  }
  return opts
}

const fmt = (n) => '$' + Math.round(n || 0).toLocaleString('es-CO')

function totalPagadoReal(pagos) {
  return pagos
    .filter((pg) => !['recargo', 'descuento'].includes(pg.tipo))
    .reduce((s, pg) => s + (pg.montoPagado || 0), 0)
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  const whereHuerfanos = {
    estado: 'activo',
    cliente: { estado: { in: ['eliminado', 'inactivo'] } },
    ...(opts.org ? { organizationId: opts.org } : {}),
  }

  const huerfanos = await prisma.prestamo.findMany({
    where: whereHuerfanos,
    select: {
      id: true,
      organizationId: true,
      montoPrestado: true,
      totalAPagar: true,
      estado: true,
      cliente: { select: { id: true, nombre: true, estado: true } },
      pagos: { select: { montoPagado: true, tipo: true } },
    },
    orderBy: { organizationId: 'asc' },
  })

  if (huerfanos.length === 0) {
    console.log('OK: no hay préstamos huérfanos (cliente eliminado/inactivo con préstamo activo).')
    await prisma.$disconnect()
    return
  }

  // Agrupar por organización para el reporte.
  const porOrg = {}
  for (const p of huerfanos) {
    const pagado = totalPagadoReal(p.pagos)
    const saldo = (p.totalAPagar || 0) - pagado
    porOrg[p.organizationId] ??= { count: 0, capital: 0, saldo: 0, items: [] }
    porOrg[p.organizationId].count++
    porOrg[p.organizationId].capital += p.montoPrestado || 0
    porOrg[p.organizationId].saldo += saldo
    porOrg[p.organizationId].items.push({ id: p.id, cliente: p.cliente?.nombre, clienteEstado: p.cliente?.estado, montoPrestado: p.montoPrestado, saldo })
  }

  if (opts.json) {
    console.log(JSON.stringify(porOrg, null, 2))
  } else {
    console.log(`\n=== PRÉSTAMOS HUÉRFANOS: ${huerfanos.length} en ${Object.keys(porOrg).length} organización(es) ===\n`)
    for (const [orgId, d] of Object.entries(porOrg)) {
      console.log(`Org ${orgId}: ${d.count} préstamo(s) | capital prestado ${fmt(d.capital)} | saldo en calle ${fmt(d.saldo)}`)
      for (const it of d.items) {
        console.log(`   - ${it.cliente} (${it.clienteEstado}) | prestado ${fmt(it.montoPrestado)} | saldo ${fmt(it.saldo)} | id ${it.id}`)
      }
      console.log('')
    }
  }

  if (!opts.fix) {
    console.log('Modo AUDITORÍA (solo lectura). Para corregir una org: --fix --org=<orgId>')
    await prisma.$disconnect()
    return
  }

  if (!opts.org) {
    console.error('SEGURIDAD: --fix requiere --org=<orgId>. No se permite arreglo global a ciegas.')
    await prisma.$disconnect()
    process.exit(1)
  }

  // ── ARREGLO: cancelar revirtiendo capital (mismo criterio que DELETE de préstamo) ──
  // Reverso del capital sin tocar el saldo global a mano: ajuste ingreso por el
  // desembolso, y reverso de recaudos/descuentos. Replica lib/capital.registrarMovimientoCapital.
  const aArreglar = huerfanos.filter((p) => p.organizationId === opts.org)
  console.log(`\nArreglando ${aArreglar.length} préstamo(s) de la org ${opts.org}...\n`)

  let okCount = 0
  for (const p of aArreglar) {
    try {
      await prisma.$transaction(async (tx) => {
        const capital = await tx.capital.findUnique({ where: { organizationId: p.organizationId } })
        if (!capital) throw new Error('Org sin registro de Capital')
        let saldo = capital.saldo

        const aplicar = async (monto, esIngreso, descripcion, referenciaTipo) => {
          const saldoAnterior = saldo
          saldo = esIngreso ? saldo + monto : saldo - monto
          await tx.movimientoCapital.create({
            data: {
              capitalId: capital.id,
              organizationId: p.organizationId,
              tipo: 'ajuste',
              monto,
              saldoAnterior,
              saldoNuevo: saldo,
              descripcion,
              referenciaId: p.id,
              referenciaTipo,
            },
          })
        }

        // 1) Reversar desembolso: el capital prestado vuelve al saldo (ingreso).
        await aplicar(p.montoPrestado || 0, true, `Reverso desembolso - prestamo huerfano (${p.cliente?.nombre})`, 'prestamo')

        // 2) Reversar recaudos reales (salen del saldo = egreso) y descuentos (ingreso).
        for (const pg of p.pagos.filter((x) => !['recargo', 'descuento'].includes(x.tipo))) {
          await aplicar(pg.montoPagado || 0, false, 'Reverso recaudo - prestamo huerfano', 'pago')
        }
        for (const pg of p.pagos.filter((x) => x.tipo === 'descuento')) {
          await aplicar(pg.montoPagado || 0, true, 'Reverso descuento - prestamo huerfano', 'pago')
        }

        await tx.capital.update({ where: { id: capital.id }, data: { saldo } })
        await tx.prestamo.update({ where: { id: p.id }, data: { estado: 'cancelado' } })
      })
      okCount++
      console.log(`   OK: ${p.cliente?.nombre} (prestado ${fmt(p.montoPrestado)}) cancelado y capital revertido.`)
    } catch (e) {
      console.error(`   ERROR en préstamo ${p.id} (${p.cliente?.nombre}): ${e.message}`)
    }
  }

  console.log(`\nArreglo terminado: ${okCount}/${aArreglar.length} préstamos corregidos.`)
  await prisma.$disconnect()
}

main().catch((e) => { console.error(e); process.exit(1) })
