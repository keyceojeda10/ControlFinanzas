#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DAY_MS = 24 * 60 * 60 * 1000

function getHoyColombiaISO() {
  const now = new Date()
  const col = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear()
  const m = String(col.getUTCMonth() + 1).padStart(2, '0')
  const d = String(col.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getColombiaDayRange(dateIso) {
  const inicio = new Date(`${dateIso}T00:00:00-05:00`)
  const finExclusivo = new Date(inicio.getTime() + DAY_MS)
  return { inicio, finExclusivo }
}

function parseArgs(argv) {
  const opts = {
    email: null,
    date: getHoyColombiaISO(),
    json: false,
    includeInactiveCollectors: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true
      continue
    }
    if (arg.startsWith('--email=')) {
      opts.email = arg.slice('--email='.length).trim().toLowerCase()
      continue
    }
    if (arg.startsWith('--date=')) {
      opts.date = arg.slice('--date='.length).trim()
      continue
    }
    if (arg === '--json') {
      opts.json = true
      continue
    }
    if (arg === '--include-inactive-collectors') {
      opts.includeInactiveCollectors = true
      continue
    }
    throw new Error(`Parametro no soportado: ${arg}`)
  }

  if (!opts.email) {
    throw new Error('Falta --email=correo@dominio.com')
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
    throw new Error('Formato de fecha invalido. Usa --date=YYYY-MM-DD')
  }

  return opts
}

function printHelp() {
  console.log('Uso: node scripts/auditar-caja-usuario.cjs --email=<correo> [opciones]')
  console.log('')
  console.log('Opciones:')
  console.log('  --date=YYYY-MM-DD               Fecha Colombia a auditar (default: hoy)')
  console.log('  --json                          Salida JSON completa')
  console.log('  --include-inactive-collectors   Incluye cobradores inactivos si usuario es owner')
  console.log('  --help                          Mostrar ayuda')
}

function sum(list, getter) {
  return list.reduce((acc, item) => acc + Number(getter(item) || 0), 0)
}

function byId(list) {
  const map = new Map()
  for (const x of list) {
    map.set(x.id, x)
  }
  return map
}

function roundMoney(value) {
  return Math.round(Number(value || 0))
}

function money(value) {
  return roundMoney(value).toLocaleString('es-CO')
}

function suggestLikelyCause(metrics) {
  const diff = roundMoney(metrics.desembolsadoAlgoritmoActual - metrics.desembolsadoPrestamosNoCancelados)

  if (diff <= 0) {
    return {
      code: 'SIN_SOBRECONTEO_OBVIO',
      detail: 'No se detecta sobreconteo vs prestamos no cancelados',
      amount: diff,
    }
  }

  if (roundMoney(metrics.totalMovimientosSinReferencia) === diff) {
    return {
      code: 'MOVIMIENTO_SIN_REFERENCIA',
      detail: 'El exceso coincide con desembolsos en MovimientoCapital sin referenciaId',
      amount: diff,
    }
  }

  const canceladosDelta = roundMoney(metrics.desembolsadoPrestamosTodos - metrics.desembolsadoPrestamosNoCancelados)
  if (canceladosDelta === diff) {
    return {
      code: 'PRESTAMOS_CANCELADOS_CONTADOS',
      detail: 'El exceso coincide con prestamos cancelados contados en desembolsado del dia',
      amount: diff,
    }
  }

  if (roundMoney(metrics.totalMovimientosHuerfanos) === diff) {
    return {
      code: 'MOVIMIENTO_HUERFANO',
      detail: 'El exceso coincide con movimientos de desembolso cuya referencia no existe en Prestamo',
      amount: diff,
    }
  }

  return {
    code: 'MIXTO_O_NO_DETERMINADO',
    detail: 'El exceso no coincide 1:1 con una sola fuente; revisar timeline y anomalias',
    amount: diff,
  }
}

async function collectCollectorAudit({ organizationId, collectorId, inicio, finExclusivo, fechaISO }) {
  const [
    prestamosRuta,
    movimientosCreador,
    actividadesCreador,
    cierre,
    pagosAgg,
    gastosAgg,
    esperadoAgg,
  ] = await Promise.all([
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: finExclusivo },
        cliente: { ruta: { cobradorId: collectorId } },
      },
      select: {
        id: true,
        montoPrestado: true,
        estado: true,
        createdAt: true,
        fechaInicio: true,
        fechaFin: true,
        clienteId: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        referenciaTipo: 'prestamo',
        creadoPorId: collectorId,
        createdAt: { gte: inicio, lt: finExclusivo },
      },
      select: {
        id: true,
        monto: true,
        referenciaId: true,
        createdAt: true,
        descripcion: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: collectorId,
        accion: 'crear_prestamo',
        createdAt: { gte: inicio, lt: finExclusivo },
      },
      select: {
        id: true,
        entidadId: true,
        createdAt: true,
        detalle: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.cierreCaja.findFirst({
      where: {
        organizationId,
        cobradorId: collectorId,
        fecha: {
          gte: new Date(`${fechaISO}T00:00:00-05:00`),
          lt: new Date(`${fechaISO}T23:59:59.999-05:00`),
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.pago.aggregate({
      where: {
        organizationId,
        cobradorId: collectorId,
        fechaPago: { gte: inicio, lt: finExclusivo },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: { _all: true },
    }),
    prisma.gastoMenor.aggregate({
      where: {
        organizationId,
        cobradorId: collectorId,
        fecha: { gte: inicio, lt: finExclusivo },
        estado: 'aprobado',
      },
      _sum: { monto: true },
      _count: { _all: true },
    }),
    prisma.ruta.findMany({
      where: { organizationId, cobradorId: collectorId, activo: true },
      select: {
        id: true,
        clientes: {
          select: {
            prestamos: {
              where: { estado: 'activo' },
              select: { cuotaDiaria: true },
            },
          },
        },
      },
    }),
  ])

  const actividadPrestamoIds = actividadesCreador
    .map((a) => a.entidadId)
    .filter(Boolean)

  const prestamosActividad = actividadPrestamoIds.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: actividadPrestamoIds },
      },
      select: {
        id: true,
        montoPrestado: true,
        estado: true,
        createdAt: true,
      },
    })
    : []

  const refIdsMovimientos = movimientosCreador
    .map((m) => m.referenciaId)
    .filter(Boolean)

  const prestamosReferenciados = refIdsMovimientos.length
    ? await prisma.prestamo.findMany({
      where: { organizationId, id: { in: refIdsMovimientos } },
      select: { id: true, montoPrestado: true, estado: true, createdAt: true },
    })
    : []

  const prestamosRefMap = byId(prestamosReferenciados)

  const idsContabilizados = new Set(prestamosRuta.map((p) => p.id))
  let totalAlgoritmoActual = sum(prestamosRuta, (p) => p.montoPrestado)

  for (const p of prestamosActividad) {
    if (!idsContabilizados.has(p.id)) {
      totalAlgoritmoActual += Number(p.montoPrestado || 0)
      idsContabilizados.add(p.id)
    }
  }

  for (const mov of movimientosCreador) {
    if (!mov.referenciaId) {
      totalAlgoritmoActual += Number(mov.monto || 0)
      continue
    }
    if (!idsContabilizados.has(mov.referenciaId)) {
      totalAlgoritmoActual += Number(mov.monto || 0)
      idsContabilizados.add(mov.referenciaId)
    }
  }

  const totalMovSinReferencia = sum(
    movimientosCreador.filter((m) => !m.referenciaId),
    (m) => m.monto,
  )

  const movimientosHuerfanos = movimientosCreador.filter((m) => m.referenciaId && !prestamosRefMap.has(m.referenciaId))
  const totalMovHuerfanos = sum(movimientosHuerfanos, (m) => m.monto)

  const movimientosPorRef = new Map()
  for (const m of movimientosCreador) {
    if (!m.referenciaId) continue
    if (!movimientosPorRef.has(m.referenciaId)) {
      movimientosPorRef.set(m.referenciaId, [])
    }
    movimientosPorRef.get(m.referenciaId).push(m)
  }

  const duplicadosPorReferencia = []
  for (const [referenciaId, rows] of movimientosPorRef.entries()) {
    if (rows.length > 1) {
      duplicadosPorReferencia.push({
        referenciaId,
        cantidad: rows.length,
        montoTotal: sum(rows, (r) => r.monto),
        movimientoIds: rows.map((r) => r.id),
      })
    }
  }

  const desembolsadoPrestamosTodos = sum(prestamosRuta, (p) => p.montoPrestado)
  const prestamosNoCancelados = prestamosRuta.filter((p) => p.estado !== 'cancelado')
  const desembolsadoPrestamosNoCancelados = sum(prestamosNoCancelados, (p) => p.montoPrestado)

  const esperado = esperadoAgg.reduce(
    (accRuta, ruta) => accRuta + ruta.clientes.reduce(
      (accCliente, c) => accCliente + sum(c.prestamos, (pr) => pr.cuotaDiaria),
      0,
    ),
    0,
  )

  const totalRecaudado = Number(pagosAgg._sum?.montoPagado || 0)
  const totalGastos = Number(gastosAgg._sum?.monto || 0)

  const saldoConAlgoritmoActual = totalRecaudado - totalGastos - totalAlgoritmoActual
  const saldoConNoCancelados = totalRecaudado - totalGastos - desembolsadoPrestamosNoCancelados

  const metrics = {
    esperado,
    totalRecaudado,
    totalGastos,
    desembolsadoAlgoritmoActual: totalAlgoritmoActual,
    desembolsadoPrestamosTodos,
    desembolsadoPrestamosNoCancelados,
    totalMovimientosSinReferencia: totalMovSinReferencia,
    totalMovimientosHuerfanos: totalMovHuerfanos,
    saldoConAlgoritmoActual,
    saldoConNoCancelados,
  }

  const likelyCause = suggestLikelyCause(metrics)

  const prestamosCanceladosDia = prestamosRuta.filter((p) => p.estado === 'cancelado')

  const timeline = [
    ...prestamosRuta.map((p) => ({
      type: 'PRESTAMO_RUTA',
      at: p.createdAt,
      id: p.id,
      amount: p.montoPrestado,
      estado: p.estado,
    })),
    ...prestamosActividad.map((p) => ({
      type: 'PRESTAMO_ACTIVIDAD',
      at: p.createdAt,
      id: p.id,
      amount: p.montoPrestado,
      estado: p.estado,
    })),
    ...movimientosCreador.map((m) => ({
      type: 'MOVIMIENTO_DESEMBOLSO',
      at: m.createdAt,
      id: m.id,
      amount: m.monto,
      referenciaId: m.referenciaId,
    })),
    ...actividadesCreador.map((a) => ({
      type: 'ACTIVIDAD_CREAR_PRESTAMO',
      at: a.createdAt,
      id: a.id,
      referenciaId: a.entidadId,
    })),
    ...(cierre
      ? [{
          type: 'CIERRE_CAJA',
          at: cierre.createdAt,
          id: cierre.id,
          totalRecogido: cierre.totalRecogido,
          totalDesembolsado: cierre.totalDesembolsado,
          saldoRealCaja: cierre.saldoRealCaja,
        }]
      : []),
  ].sort((a, b) => new Date(a.at) - new Date(b.at))

  return {
    collectorId,
    cierre,
    metrics,
    likelyCause,
    counts: {
      pagos: pagosAgg._count?._all || 0,
      gastos: gastosAgg._count?._all || 0,
      prestamosRuta: prestamosRuta.length,
      prestamosActividad: prestamosActividad.length,
      movimientosDesembolso: movimientosCreador.length,
      prestamosCanceladosDia: prestamosCanceladosDia.length,
      movimientosHuerfanos: movimientosHuerfanos.length,
      referenciasDuplicadas: duplicadosPorReferencia.length,
    },
    anomalies: {
      prestamosCanceladosDia,
      movimientosSinReferencia: movimientosCreador.filter((m) => !m.referenciaId),
      movimientosHuerfanos,
      duplicadosPorReferencia,
    },
    timeline,
  }
}

function printCollectorSummary(collector, audit) {
  console.log('')
  console.log(`- Cobrador: ${collector.nombre} (${collector.email})`)
  console.log(`  ID: ${collector.id}`)
  if (audit.cierre) {
    console.log(`  Cierre actual: recogido $${money(audit.cierre.totalRecogido)} | desembolsado $${money(audit.cierre.totalDesembolsado)} | saldoRealCaja $${money(audit.cierre.saldoRealCaja)}`)
  } else {
    console.log('  Cierre actual: no existe cierre registrado para la fecha')
  }

  console.log(`  Recaudado real (pagos): $${money(audit.metrics.totalRecaudado)}`)
  console.log(`  Gastos aprobados: $${money(audit.metrics.totalGastos)}`)
  console.log(`  Desembolsado algoritmo actual: $${money(audit.metrics.desembolsadoAlgoritmoActual)}`)
  console.log(`  Desembolsado prestamos no cancelados: $${money(audit.metrics.desembolsadoPrestamosNoCancelados)}`)
  console.log(`  Saldo con algoritmo actual: $${money(audit.metrics.saldoConAlgoritmoActual)}`)
  console.log(`  Saldo con no cancelados: $${money(audit.metrics.saldoConNoCancelados)}`)

  const cause = audit.likelyCause
  console.log(`  Causa probable: ${cause.code} (${cause.detail}) | monto $${money(cause.amount)}`)

  if (audit.anomalies.prestamosCanceladosDia.length) {
    console.log(`  Prestamos cancelados del dia: ${audit.anomalies.prestamosCanceladosDia.length}`)
  }
  if (audit.anomalies.movimientosSinReferencia.length) {
    console.log(`  Movimientos sin referenciaId: ${audit.anomalies.movimientosSinReferencia.length}`)
  }
  if (audit.anomalies.movimientosHuerfanos.length) {
    console.log(`  Movimientos huerfanos: ${audit.anomalies.movimientosHuerfanos.length}`)
  }
  if (audit.anomalies.duplicadosPorReferencia.length) {
    console.log(`  Referencias con movimientos duplicados: ${audit.anomalies.duplicadosPorReferencia.length}`)
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const dbUrl = process.env.DATABASE_URL || ''

  if (opts.help) {
    printHelp()
    return
  }

  if (!dbUrl.startsWith('mysql://')) {
    throw new Error(
      'Este script usa Prisma con provider MySQL. Configura DATABASE_URL con mysql://... para ejecutar la auditoria.',
    )
  }

  const { inicio, finExclusivo } = getColombiaDayRange(opts.date)

  const user = await prisma.user.findUnique({
    where: { email: opts.email },
    select: {
      id: true,
      nombre: true,
      email: true,
      rol: true,
      activo: true,
      organizationId: true,
      organization: { select: { id: true, nombre: true, plan: true } },
    },
  })

  if (!user) {
    throw new Error(`No existe usuario con email ${opts.email}`)
  }
  if (!user.organizationId) {
    throw new Error(`El usuario ${opts.email} no tiene organizationId`) 
  }

  let collectors = []
  if (user.rol === 'owner') {
    collectors = await prisma.user.findMany({
      where: {
        organizationId: user.organizationId,
        rol: 'cobrador',
        ...(opts.includeInactiveCollectors ? {} : { activo: true }),
      },
      select: { id: true, nombre: true, email: true, activo: true },
      orderBy: { nombre: 'asc' },
    })
  } else if (user.rol === 'cobrador') {
    collectors = [{ id: user.id, nombre: user.nombre, email: user.email, activo: user.activo }]
  } else {
    throw new Error(`Rol no soportado para auditoria operativa: ${user.rol}`)
  }

  const audits = []
  for (const collector of collectors) {
    const audit = await collectCollectorAudit({
      organizationId: user.organizationId,
      collectorId: collector.id,
      inicio,
      finExclusivo,
      fechaISO: opts.date,
    })
    audits.push({ collector, audit })
  }

  const output = {
    runAt: new Date().toISOString(),
    dateColombia: opts.date,
    rangeUtc: {
      inicio: inicio.toISOString(),
      finExclusivo: finExclusivo.toISOString(),
    },
    targetUser: user,
    collectorsAudited: collectors.length,
    results: audits,
  }

  if (opts.json) {
    console.log(JSON.stringify(output, null, 2))
    return
  }

  console.log('AUDITORIA DE CAJA POR USUARIO')
  console.log('==============================')
  console.log(`Fecha Colombia: ${opts.date}`)
  console.log(`Rango UTC: ${inicio.toISOString()} -> ${finExclusivo.toISOString()} (exclusivo)`)
  console.log(`Usuario objetivo: ${user.nombre} (${user.email})`) 
  console.log(`Organizacion: ${user.organization?.nombre || user.organizationId}`)
  console.log(`Rol objetivo: ${user.rol}`)
  console.log(`Cobradores auditados: ${collectors.length}`)

  for (const row of audits) {
    printCollectorSummary(row.collector, row.audit)
  }

  const targetLike = audits.find((x) => {
    const closeRec = roundMoney(x.audit.metrics.totalRecaudado) === 825000
    const closeLoan = roundMoney(x.audit.metrics.desembolsadoAlgoritmoActual) === 1000000 || roundMoney(x.audit.metrics.desembolsadoPrestamosNoCancelados) === 500000
    return closeRec || closeLoan
  })

  if (targetLike) {
    console.log('')
    console.log('POSIBLE CASO COINCIDENTE CON EL REPORTE DEL CLIENTE')
    console.log('----------------------------------------------------')
    console.log(`Cobrador: ${targetLike.collector.nombre} (${targetLike.collector.email})`)
    console.log(`Recaudado: $${money(targetLike.audit.metrics.totalRecaudado)}`)
    console.log(`Prestado algoritmo: $${money(targetLike.audit.metrics.desembolsadoAlgoritmoActual)}`)
    console.log(`Prestado no cancelados: $${money(targetLike.audit.metrics.desembolsadoPrestamosNoCancelados)}`)
    console.log(`Saldo algoritmo: $${money(targetLike.audit.metrics.saldoConAlgoritmoActual)}`)
    console.log(`Saldo no cancelados: $${money(targetLike.audit.metrics.saldoConNoCancelados)}`)
    console.log(`Causa probable: ${targetLike.audit.likelyCause.code}`)
  }
}

main()
  .catch((err) => {
    console.error('[auditar-caja-usuario] Error:', err.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
