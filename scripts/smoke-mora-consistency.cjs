#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
require('dotenv').config()

const { PrismaClient } = require('@prisma/client')

const prisma = new PrismaClient()

const DAY_MS = 24 * 60 * 60 * 1000
const TIPOS_AJUSTE = ['recargo', 'descuento']

function inicioDiaColombia(valor = Date.now()) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const col = new Date(fecha.getTime() - 5 * 60 * 60 * 1000)
  return new Date(Date.UTC(col.getUTCFullYear(), col.getUTCMonth(), col.getUTCDate(), 5, 0, 0, 0))
}

function mananaColombia(valor = Date.now()) {
  const h = inicioDiaColombia(valor)
  return new Date(h.getTime() + DAY_MS)
}

function formatoFechaColombia(valor = Date.now()) {
  const fecha = valor instanceof Date ? valor : new Date(valor)
  const col = new Date(fecha.getTime() - 5 * 60 * 60 * 1000)
  const y = col.getUTCFullYear()
  const m = String(col.getUTCMonth() + 1).padStart(2, '0')
  const d = String(col.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parsearDiasSinCobro(valor) {
  if (!valor) return null
  try {
    const arr = typeof valor === 'string' ? JSON.parse(valor) : valor
    if (!Array.isArray(arr)) return null
    return arr.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
  } catch {
    return null
  }
}

function obtenerDiasSinCobro(cliente, ruta, org) {
  const c = parsearDiasSinCobro(cliente?.diasSinCobro)
  if (c !== null) return c

  const r = parsearDiasSinCobro(ruta?.diasSinCobro)
  if (r !== null) return r

  const o = parsearDiasSinCobro(org?.diasSinCobro)
  if (o !== null) return o

  return []
}

function esDiaSinCobro(fechaReferencia, diasExcluidos) {
  if (!diasExcluidos || diasExcluidos.length === 0) return false
  const col = new Date(fechaReferencia.getTime() - 5 * 60 * 60 * 1000)
  return diasExcluidos.includes(col.getUTCDay())
}

function contarDiasExcluidos(fechaInicio, fechaFin, diasExcluidos) {
  if (!diasExcluidos || diasExcluidos.length === 0) return 0

  const inicio = new Date(fechaInicio)
  inicio.setHours(0, 0, 0, 0)
  const fin = new Date(fechaFin)
  fin.setHours(0, 0, 0, 0)

  const totalDias = Math.floor((fin - inicio) / DAY_MS) + 1
  if (totalDias <= 0) return 0

  const semanasCompletas = Math.floor(totalDias / 7)
  const diasRestantes = totalDias % 7
  let count = semanasCompletas * diasExcluidos.length

  const diaInicio = inicio.getDay()
  for (let i = 0; i < diasRestantes; i += 1) {
    if (diasExcluidos.includes((diaInicio + semanasCompletas * 7 + i) % 7)) {
      count += 1
    }
  }

  return count
}

function calcularDiasTranscurridosCobrables(inicio, fecha, diasExcluidos = []) {
  const inicioCol = inicioDiaColombia(inicio)
  const fechaCol = inicioDiaColombia(fecha)
  const diasCalendario = Math.floor((fechaCol - inicioCol) / DAY_MS)
  const diasDescontados = diasExcluidos.length > 0
    ? contarDiasExcluidos(inicioCol, fechaCol, diasExcluidos)
    : 0

  return Math.max(0, diasCalendario - diasDescontados)
}

function calcularSaldoPendiente(prestamo) {
  const pagado = (prestamo.pagos ?? []).reduce(
    (acc, p) => (TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0)),
    0
  )
  return Math.max(0, (prestamo.totalAPagar ?? 0) - pagado)
}

function calcularProximoCobro(prestamo, diasExcluidos = []) {
  if (!prestamo?.fechaInicio) return null
  if (prestamo.estado && prestamo.estado !== 'activo') return null
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return null

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1

  const inicioMed = inicioDiaColombia(prestamo.fechaInicio)
  const pagado = Array.isArray(prestamo.pagos)
    ? prestamo.pagos.reduce((acc, p) => (TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0)), 0)
    : 0
  const periodosCubiertos = Math.floor(pagado / prestamo.cuotaDiaria)

  const totalPeriodosPorPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const totalPeriodosPorMonto = prestamo.totalAPagar
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  const totalPeriodos = totalPeriodosPorPlazo || totalPeriodosPorMonto

  if (totalPeriodos && periodosCubiertos >= totalPeriodos) return null

  const proximaCuotaNum = periodosCubiertos + 1
  const diasCobrablesObjetivo = proximaCuotaNum * diasPeriodo

  if (!diasExcluidos || diasExcluidos.length === 0) {
    return new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
  }

  let fecha = new Date(inicioMed)
  const maxIteraciones = 5000
  for (let i = 0; i < maxIteraciones; i += 1) {
    const diasCobrables = calcularDiasTranscurridosCobrables(inicioMed, fecha, diasExcluidos)
    if (diasCobrables >= diasCobrablesObjetivo) return fecha
    fecha = new Date(fecha.getTime() + DAY_MS)
  }

  return new Date(inicioMed.getTime() + diasCobrablesObjetivo * DAY_MS)
}

function tieneCobroPendienteHoy(prestamo, diasExcluidos = [], fechaReferencia = new Date()) {
  if (!prestamo || prestamo.estado !== 'activo') return false
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return false
  if (calcularSaldoPendiente(prestamo) <= 0) return false

  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  const hoy = inicioDiaColombia(fechaReferencia)
  if (inicio > hoy) return false

  const freq = prestamo.frecuencia || 'diario'
  const diasPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const diasCobrablesTranscurridos = calcularDiasTranscurridosCobrables(inicio, hoy, diasExcluidos)

  let periodosEsperados = Math.floor(diasCobrablesTranscurridos / diasPeriodo)

  const totalPeriodosPorPlazo = prestamo.diasPlazo
    ? Math.ceil(prestamo.diasPlazo / diasPeriodo)
    : null
  const totalPeriodosPorMonto = prestamo.totalAPagar
    ? Math.ceil(prestamo.totalAPagar / prestamo.cuotaDiaria)
    : null
  const totalPeriodos = totalPeriodosPorPlazo || totalPeriodosPorMonto
  if (totalPeriodos) {
    periodosEsperados = Math.min(periodosEsperados, totalPeriodos)
  }

  if (periodosEsperados <= 0) return false

  const esperadoPorPeriodo = periodosEsperados * prestamo.cuotaDiaria
  const esperado = prestamo.totalAPagar
    ? Math.min(esperadoPorPeriodo, prestamo.totalAPagar)
    : esperadoPorPeriodo

  const pagado = Array.isArray(prestamo.pagos)
    ? prestamo.pagos.reduce((acc, p) => (TIPOS_AJUSTE.includes(p.tipo) ? acc : acc + (p.montoPagado ?? 0)), 0)
    : 0

  return pagado < esperado
}

function calcularDiasMora(prestamo, diasExcluidos = [], fechaReferencia = new Date()) {
  if (prestamo.estado !== 'activo') return 0
  if (!prestamo.cuotaDiaria || prestamo.cuotaDiaria <= 0) return 0
  if (calcularSaldoPendiente(prestamo) <= 0) return 0

  const hoy = inicioDiaColombia(fechaReferencia)
  const inicio = inicioDiaColombia(prestamo.fechaInicio)
  if (inicio > hoy) return 0

  const freq = prestamo.frecuencia || 'diario'
  const diasPorPeriodo = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }[freq] || 1
  const proximoCobro = calcularProximoCobro(prestamo, diasExcluidos)

  if (!proximoCobro) return 0

  const proximoDia = inicioDiaColombia(proximoCobro)
  if (proximoDia > hoy) return 0

  const manana = new Date(hoy.getTime() + DAY_MS)
  const diasAtraso = calcularDiasTranscurridosCobrables(proximoDia, manana, diasExcluidos)
  const gracia = diasPorPeriodo === 1 ? 1 : 2
  return Math.max(0, diasAtraso - gracia)
}

function parseArgs(argv) {
  const opts = {
    orgId: null,
    fecha: null,
    sample: 20,
    help: false,
  }

  for (const arg of argv) {
    if (arg === '--help' || arg === '-h') {
      opts.help = true
      continue
    }
    if (arg.startsWith('--org=')) {
      opts.orgId = arg.slice('--org='.length)
      continue
    }
    if (arg.startsWith('--date=')) {
      opts.fecha = arg.slice('--date='.length)
      continue
    }
    if (arg.startsWith('--sample=')) {
      const sample = Number(arg.slice('--sample='.length))
      if (!Number.isInteger(sample) || sample < 1 || sample > 1000) {
        throw new Error('Parametro --sample invalido. Usa un entero entre 1 y 1000.')
      }
      opts.sample = sample
      continue
    }
    throw new Error(`Parametro no soportado: ${arg}`)
  }

  return opts
}

function parseFechaReferencia(fechaISO) {
  if (!fechaISO) return new Date()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaISO)) {
    throw new Error('Formato de fecha invalido. Usa --date=YYYY-MM-DD')
  }
  return new Date(`${fechaISO}T05:00:00.000Z`)
}

function imprimirAyuda() {
  console.log('Uso: node scripts/smoke-mora-consistency.cjs [opciones]')
  console.log('')
  console.log('Opciones:')
  console.log('  --org=<organizationId>   Evalua solo una organizacion')
  console.log('  --date=YYYY-MM-DD        Evalua la logica para ese dia (zona Colombia)')
  console.log('  --sample=<n>             Muestra hasta n inconsistencias (default 20)')
  console.log('  --help                   Muestra esta ayuda')
}

function evaluarCliente(cliente, ruta, org, contexto) {
  const diasExcluidos = obtenerDiasSinCobro(cliente, ruta, org)
  const hoySinCobro = esDiaSinCobro(contexto.referencia, diasExcluidos)

  let pagadoHoy = 0
  let mora = 0
  let frecuencia = 'diario'
  let proximoCobro = null
  let cobroPendienteHoy = false

  for (const prestamo of cliente.prestamos) {
    const pagosHoy = prestamo.pagos.filter((pago) => {
      const fechaPago = new Date(pago.fechaPago)
      return fechaPago >= contexto.hoy && fechaPago < contexto.manana
    })

    const montoPagadoHoy = pagosHoy
      .filter((pago) => !TIPOS_AJUSTE.includes(pago.tipo))
      .reduce((acc, pago) => acc + pago.montoPagado, 0)

    pagadoHoy += montoPagadoHoy
    mora = Math.max(mora, calcularDiasMora(prestamo, diasExcluidos, contexto.referencia))

    frecuencia = prestamo.frecuencia || 'diario'
    const pc = calcularProximoCobro(prestamo, diasExcluidos)
    if (pc && (!proximoCobro || pc < proximoCobro)) proximoCobro = pc

    if (!hoySinCobro && tieneCobroPendienteHoy(prestamo, diasExcluidos, contexto.referencia)) {
      cobroPendienteHoy = true
    }
  }

  const pagoHoy = pagadoHoy > 0
  const pendienteHoyCliente = !hoySinCobro && cobroPendienteHoy

  let diasParaCobro = null
  if (proximoCobro) {
    diasParaCobro = Math.round((proximoCobro.getTime() - contexto.hoy.getTime()) / DAY_MS)
  }

  if (pagoHoy && !pendienteHoyCliente && diasParaCobro === 0) {
    diasParaCobro = 1
  }

  const totalPrestamosActivos = cliente.prestamos.length
  const estado = totalPrestamosActivos === 0 ? 'completado' : (mora > 0 ? 'mora' : 'activo')

  return {
    organizationId: org.id,
    organizationNombre: org.nombre,
    rutaId: ruta.id,
    rutaNombre: ruta.nombre,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    totalPrestamosActivos,
    estado,
    frecuencia,
    hoySinCobro,
    pagoHoy,
    pagadoHoy,
    cobroPendienteHoy: pendienteHoyCliente,
    diasMora: mora,
    diasParaCobro,
    proximoCobro,
  }
}

function registrarInconsistencia(resumen, tipo, cliente, detalle) {
  resumen.inconsistencias += 1
  resumen.porTipo[tipo] = (resumen.porTipo[tipo] ?? 0) + 1

  if (resumen.ejemplos.length < resumen.sampleLimit) {
    resumen.ejemplos.push({
      tipo,
      detalle,
      organizationId: cliente.organizationId,
      organizationNombre: cliente.organizationNombre,
      rutaId: cliente.rutaId,
      rutaNombre: cliente.rutaNombre,
      clienteId: cliente.clienteId,
      clienteNombre: cliente.clienteNombre,
    })
  }
}

function evaluarConsistenciaCliente(cliente, contexto, resumen) {
  if (cliente.hoySinCobro && cliente.cobroPendienteHoy) {
    registrarInconsistencia(
      resumen,
      'cobro-pendiente-en-dia-sin-cobro',
      cliente,
      'hoySinCobro=true y cobroPendienteHoy=true'
    )
  }

  if (cliente.pagoHoy && !cliente.cobroPendienteHoy && cliente.diasParaCobro === 0) {
    registrarInconsistencia(
      resumen,
      'dias-para-cobro-cero-despues-de-pago',
      cliente,
      'pagoHoy=true, sin pendiente y diasParaCobro=0'
    )
  }

  if (cliente.pagoHoy && cliente.pagadoHoy <= 0) {
    registrarInconsistencia(
      resumen,
      'flag-pago-hoy-sin-monto',
      cliente,
      `pagoHoy=true con pagadoHoy=${cliente.pagadoHoy}`
    )
  }

  if (!cliente.pagoHoy && cliente.pagadoHoy > 0) {
    registrarInconsistencia(
      resumen,
      'pagado-hoy-sin-flag-pago-hoy',
      cliente,
      `pagoHoy=false con pagadoHoy=${cliente.pagadoHoy}`
    )
  }

  if (cliente.diasMora < 0) {
    registrarInconsistencia(
      resumen,
      'dias-mora-negativo',
      cliente,
      `diasMora=${cliente.diasMora}`
    )
  }

  if (cliente.estado === 'completado' && cliente.totalPrestamosActivos > 0) {
    registrarInconsistencia(
      resumen,
      'estado-completado-con-prestamo-activo',
      cliente,
      `estado=${cliente.estado} con prestamosActivos=${cliente.totalPrestamosActivos}`
    )
  }

  if (cliente.estado !== 'completado' && cliente.totalPrestamosActivos === 0) {
    registrarInconsistencia(
      resumen,
      'estado-no-completado-sin-prestamo',
      cliente,
      `estado=${cliente.estado} con prestamosActivos=0`
    )
  }

  if (cliente.proximoCobro && cliente.diasParaCobro === null) {
    registrarInconsistencia(
      resumen,
      'proximo-cobro-sin-dias-para-cobro',
      cliente,
      'proximoCobro tiene valor pero diasParaCobro es null'
    )
  }

  if (!cliente.proximoCobro && cliente.diasParaCobro !== null) {
    registrarInconsistencia(
      resumen,
      'dias-para-cobro-sin-proximo-cobro',
      cliente,
      `diasParaCobro=${cliente.diasParaCobro} con proximoCobro=null`
    )
  }

  if (cliente.proximoCobro && typeof cliente.diasParaCobro === 'number') {
    let esperado = Math.round((cliente.proximoCobro.getTime() - contexto.hoy.getTime()) / DAY_MS)
    if (cliente.pagoHoy && !cliente.cobroPendienteHoy && esperado === 0) {
      esperado = 1
    }
    if (esperado !== cliente.diasParaCobro) {
      registrarInconsistencia(
        resumen,
        'dias-para-cobro-no-coincide',
        cliente,
        `esperado=${esperado}, recibido=${cliente.diasParaCobro}`
      )
    }
  }
}

function imprimirResumen(resumen, fechaLabel) {
  console.log('SMOKE TEST: mora / proximo cobro / pago hoy')
  console.log(`Fecha evaluada (America/Bogota): ${fechaLabel}`)
  console.log(`Organizaciones evaluadas: ${resumen.organizaciones}`)
  console.log(`Rutas evaluadas: ${resumen.rutas}`)
  console.log(`Clientes evaluados: ${resumen.clientes}`)
  console.log(`Clientes con prestamo activo: ${resumen.clientesConPrestamo}`)
  console.log(`Prestamos activos evaluados: ${resumen.prestamosActivos}`)
  console.log(`Inconsistencias detectadas: ${resumen.inconsistencias}`)

  const tipos = Object.entries(resumen.porTipo).sort((a, b) => b[1] - a[1])
  if (tipos.length > 0) {
    console.log('')
    console.log('Detalle por tipo:')
    for (const [tipo, cantidad] of tipos) {
      console.log(`- ${tipo}: ${cantidad}`)
    }
  }

  if (resumen.ejemplos.length > 0) {
    console.log('')
    console.log(`Ejemplos (max ${resumen.sampleLimit}):`)
    for (const ejemplo of resumen.ejemplos) {
      console.log(
        `- [${ejemplo.tipo}] org=${ejemplo.organizationNombre} (${ejemplo.organizationId})` +
        ` | ruta=${ejemplo.rutaNombre} (${ejemplo.rutaId})` +
        ` | cliente=${ejemplo.clienteNombre} (${ejemplo.clienteId})` +
        ` | ${ejemplo.detalle}`
      )
    }
  }

  if (resumen.inconsistencias === 0) {
    console.log('')
    console.log('OK: no se detectaron inconsistencias.')
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  if (opts.help) {
    imprimirAyuda()
    return
  }

  const databaseUrl = process.env.DATABASE_URL || ''
  if (!databaseUrl.startsWith('mysql://')) {
    throw new Error('DATABASE_URL invalida para este proyecto. Debe iniciar con mysql://')
  }

  const fechaReferencia = parseFechaReferencia(opts.fecha)
  const contexto = {
    referencia: fechaReferencia,
    hoy: inicioDiaColombia(fechaReferencia),
    manana: mananaColombia(fechaReferencia),
  }

  const orgWhere = opts.orgId ? { id: opts.orgId } : { activo: true }
  const organizaciones = await prisma.organization.findMany({
    where: orgWhere,
    select: {
      id: true,
      nombre: true,
      diasSinCobro: true,
    },
    orderBy: { createdAt: 'asc' },
  })

  if (organizaciones.length === 0) {
    throw new Error('No se encontraron organizaciones para evaluar.')
  }

  const resumen = {
    sampleLimit: opts.sample,
    organizaciones: organizaciones.length,
    rutas: 0,
    clientes: 0,
    clientesConPrestamo: 0,
    prestamosActivos: 0,
    inconsistencias: 0,
    porTipo: {},
    ejemplos: [],
  }

  for (const org of organizaciones) {
    const rutas = await prisma.ruta.findMany({
      where: {
        organizationId: org.id,
        activo: true,
      },
      select: {
        id: true,
        nombre: true,
        diasSinCobro: true,
        clientes: {
          select: {
            id: true,
            nombre: true,
            diasSinCobro: true,
            prestamos: {
              where: { estado: 'activo' },
              select: {
                id: true,
                estado: true,
                cuotaDiaria: true,
                totalAPagar: true,
                montoPrestado: true,
                frecuencia: true,
                fechaInicio: true,
                diasPlazo: true,
                pagos: {
                  select: {
                    montoPagado: true,
                    fechaPago: true,
                    tipo: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    resumen.rutas += rutas.length

    for (const ruta of rutas) {
      resumen.clientes += ruta.clientes.length

      for (const cliente of ruta.clientes) {
        if (cliente.prestamos.length > 0) {
          resumen.clientesConPrestamo += 1
          resumen.prestamosActivos += cliente.prestamos.length
        }

        const datosCliente = evaluarCliente(cliente, ruta, org, contexto)
        evaluarConsistenciaCliente(datosCliente, contexto, resumen)
      }
    }
  }

  imprimirResumen(resumen, formatoFechaColombia(fechaReferencia))

  if (resumen.inconsistencias > 0) {
    process.exitCode = 1
  }
}

main()
  .catch((error) => {
    console.error('Error ejecutando smoke test:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
