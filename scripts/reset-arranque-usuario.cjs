#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()
const DAY_MS = 24 * 60 * 60 * 1000

function getHoyColombiaISO() {
  const ahora = new Date()
  const col = new Date(ahora.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear()
  const m = String(col.getUTCMonth() + 1).padStart(2, '0')
  const d = String(col.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function getColombiaDayRange(fechaIso) {
  return {
    inicio: new Date(`${fechaIso}T00:00:00-05:00`),
    fin: new Date(`${fechaIso}T23:59:59.999-05:00`),
  }
}

function parseArgs(argv) {
  const opts = {
    email: null,
    capital: null,
    fecha: getHoyColombiaISO(),
    limpiarOperativaDia: false,
    apply: false,
    reason: 'Reset de arranque solicitado por soporte',
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
    if (arg.startsWith('--capital=')) {
      const raw = arg.slice('--capital='.length).replace(/\./g, '').trim()
      const value = Number(raw)
      if (!Number.isFinite(value) || value < 0) {
        throw new Error('Parametro --capital invalido. Usa un numero >= 0 (ej: --capital=412000).')
      }
      opts.capital = Math.round(value)
      continue
    }
    if (arg.startsWith('--date=')) {
      opts.fecha = arg.slice('--date='.length).trim()
      continue
    }
    if (arg === '--limpiar-operativa-dia') {
      opts.limpiarOperativaDia = true
      continue
    }
    if (arg === '--apply') {
      opts.apply = true
      continue
    }
    if (arg.startsWith('--reason=')) {
      const value = arg.slice('--reason='.length).trim()
      if (value) opts.reason = value
      continue
    }

    throw new Error(`Parametro no soportado: ${arg}`)
  }

  if (!opts.help) {
    if (!opts.email) {
      throw new Error('Falta --email=correo@dominio.com')
    }
    if (opts.capital === null) {
      throw new Error('Falta --capital=<monto>. Ejemplo: --capital=412000')
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(opts.fecha)) {
      throw new Error('Formato de fecha invalido. Usa --date=YYYY-MM-DD')
    }
  }

  return opts
}

function printHelp() {
  console.log('Uso: node scripts/reset-arranque-usuario.cjs --email=<correo> --capital=<monto> [opciones]')
  console.log('')
  console.log('Opciones:')
  console.log('  --date=YYYY-MM-DD          Fecha Colombia para limpiar operativa del dia (default: hoy)')
  console.log('  --limpiar-operativa-dia    Mueve prestamos activos de ese dia al dia anterior')
  console.log('  --reason="texto"           Razon para registrar en movimiento inicial de capital')
  console.log('  --apply                    Ejecuta cambios. Sin este flag corre en dry-run')
  console.log('  --help                     Mostrar ayuda')
  console.log('')
  console.log('Ejemplo (simulacion):')
  console.log('  node scripts/reset-arranque-usuario.cjs --email=mikediaz2595@gmail.com --capital=412000 --limpiar-operativa-dia')
  console.log('')
  console.log('Ejemplo (aplicar):')
  console.log('  node scripts/reset-arranque-usuario.cjs --email=mikediaz2595@gmail.com --capital=412000 --limpiar-operativa-dia --apply')
}

async function loadContext({ email, fecha }) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      nombre: true,
      organizationId: true,
      organization: { select: { id: true, nombre: true, createdAt: true } },
    },
  })

  if (!user || !user.organizationId) {
    throw new Error(`No se encontro usuario/organizacion para ${email}`)
  }

  const organizationId = user.organizationId
  const { inicio, fin } = getColombiaDayRange(fecha)

  const [capital, movimientosCount, prestamosDia] = await Promise.all([
    prisma.capital.findUnique({
      where: { organizationId },
      select: { id: true, saldo: true, createdAt: true, updatedAt: true },
    }),
    prisma.movimientoCapital.count({ where: { organizationId } }),
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lte: fin },
        estado: { not: 'cancelado' },
      },
      select: {
        id: true,
        montoPrestado: true,
        estado: true,
        createdAt: true,
        cliente: { select: { id: true, nombre: true } },
      },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  const desembolsadoDia = Math.round(
    prestamosDia.reduce((acc, p) => acc + Number(p.montoPrestado || 0), 0)
  )

  return {
    user,
    organizationId,
    fecha,
    capital,
    movimientosCount,
    prestamosDia,
    desembolsadoDia,
  }
}

async function applyReset({ ctx, capitalObjetivo, limpiarOperativaDia, reason }) {
  const organizationId = ctx.organizationId
  const referenceId = `reset-arranque-${ctx.fecha}-${Date.now()}`

  return prisma.$transaction(async (tx) => {
    let capital = ctx.capital
    if (!capital) {
      capital = await tx.capital.create({
        data: {
          organizationId,
          saldo: 0,
        },
      })
    }

    await tx.movimientoCapital.deleteMany({ where: { organizationId } })

    await tx.capital.update({
      where: { id: capital.id },
      data: { saldo: capitalObjetivo },
    })

    const movimientoInicial = await tx.movimientoCapital.create({
      data: {
        capitalId: capital.id,
        organizationId,
        tipo: 'capital_inicial',
        monto: capitalObjetivo,
        saldoAnterior: 0,
        saldoNuevo: capitalObjetivo,
        descripcion: reason,
        referenciaTipo: 'reset_arranque_script',
        referenciaId,
        creadoPorId: ctx.user.id,
      },
    })

    const prestamosAjustados = []

    if (limpiarOperativaDia && ctx.prestamosDia.length > 0) {
      const base = new Date(`${ctx.fecha}T12:00:00-05:00`)
      const baseAyer = new Date(base.getTime() - DAY_MS)

      for (let i = 0; i < ctx.prestamosDia.length; i += 1) {
        const p = ctx.prestamosDia[i]
        const nuevoCreatedAt = new Date(baseAyer.getTime() + i * 60 * 1000)

        await tx.prestamo.update({
          where: { id: p.id },
          data: { createdAt: nuevoCreatedAt },
        })

        await tx.actividadLog.updateMany({
          where: {
            organizationId,
            accion: 'crear_prestamo',
            entidadTipo: 'prestamo',
            entidadId: p.id,
          },
          data: { createdAt: nuevoCreatedAt },
        })

        prestamosAjustados.push({
          id: p.id,
          cliente: p.cliente?.nombre || null,
          monto: Math.round(p.montoPrestado || 0),
          beforeCreatedAt: p.createdAt,
          afterCreatedAt: nuevoCreatedAt,
        })
      }
    }

    return {
      movimientoInicialId: movimientoInicial.id,
      prestamosAjustados,
    }
  })
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    printHelp()
    return
  }

  const ctx = await loadContext({ email: opts.email, fecha: opts.fecha })

  const dryRun = !opts.apply
  const plan = {
    mode: dryRun ? 'dry-run' : 'apply',
    email: ctx.user.email,
    usuario: ctx.user.nombre,
    organization: ctx.user.organization,
    fechaOperativa: opts.fecha,
    capitalObjetivo: opts.capital,
    limpiarOperativaDia: opts.limpiarOperativaDia,
    before: {
      capitalExists: !!ctx.capital,
      capitalSaldo: Math.round(ctx.capital?.saldo || 0),
      movimientosCapital: ctx.movimientosCount,
      prestamosActivosNoCanceladosEnFecha: ctx.prestamosDia.length,
      desembolsadoDia: ctx.desembolsadoDia,
    },
    prestamosDia: ctx.prestamosDia.map((p) => ({
      id: p.id,
      cliente: p.cliente?.nombre || null,
      monto: Math.round(p.montoPrestado || 0),
      createdAt: p.createdAt,
      estado: p.estado,
    })),
  }

  if (dryRun) {
    console.log(JSON.stringify({ ok: true, ...plan }, null, 2))
    console.log('\nDry-run finalizado. Agrega --apply para ejecutar cambios reales.')
    return
  }

  const applied = await applyReset({
    ctx,
    capitalObjetivo: opts.capital,
    limpiarOperativaDia: opts.limpiarOperativaDia,
    reason: opts.reason,
  })

  const after = await loadContext({ email: opts.email, fecha: opts.fecha })

  const result = {
    ok: true,
    ...plan,
    applied: {
      movimientoInicialId: applied.movimientoInicialId,
      prestamosAjustados: applied.prestamosAjustados,
    },
    after: {
      capitalSaldo: Math.round(after.capital?.saldo || 0),
      movimientosCapital: after.movimientosCount,
      prestamosActivosNoCanceladosEnFecha: after.prestamosDia.length,
      desembolsadoDia: after.desembolsadoDia,
      capitalUpdatedAt: after.capital?.updatedAt || null,
    },
  }

  console.log(JSON.stringify(result, null, 2))
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
