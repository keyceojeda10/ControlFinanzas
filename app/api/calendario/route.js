// app/api/calendario/route.js — el calendario de cobros.
//
//   GET /api/calendario?mes=2026-11[&rutaId=…]          → el resumen de cada día del mes
//   GET /api/calendario?mes=2026-11&dia=2026-11-14[…]   → además, la lista de ese día
//
// La cuenta vive en `lib/calendario-cobros.js` (`armarCalendario`), que no tiene
// calendario propio: usa `tocaCobrarEn` y, para hoy, `loDeHoyDelPrestamo`.
//
// ⚠ EL MES ENTERO SOLO LLEVA EL RESUMEN. Un negocio de cobro diario con 2.000
//   préstamos son 60.000 renglones al mes; la lista de un día se pide al tocarlo.
//
// ⚠ LO PASADO ES DE BÁSICO EN ADELANTE (el dueño, 6 nov 2026). Sin el plan, el
//   rango empieza hoy y se dice `conPasado: false`, para que la pantalla ofrezca
//   el plan en vez de enseñar días vacíos como si no se hubiera cobrado nada.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getUtcOffset } from '@/lib/i18n'
import { nivelReportes } from '@/lib/planes'
import { CAMPOS_DEL_REPARTO } from '@/lib/dinero/capital-base'
import { pagosDelCalculoPorPrestamo } from '@/lib/dinero/pagos-del-calculo'
import { esAbonoPrevio } from '@/lib/dinero/abono-previo'
import { armarCalendario, diaIso, fechaDe } from '@/lib/calendario-cobros'

/** Cuántos meses hacia adelante se puede mirar. Más allá, casi nada sigue vivo. */
const MESES_ADELANTE = 3

function hoyIso(country = 'co') {
  const off = Math.abs(getUtcOffset(country))
  return new Date(Date.now() - off * 3600000).toISOString().slice(0, 10)
}

async function alcanzaElPlan(session) {
  if (nivelReportes(session?.user?.plan) >= 1) return true
  const org = await prisma.organization.findUnique({ where: { id: session.user.organizationId }, select: { plan: true } })
  return nivelReportes(org?.plan) >= 1
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })

  const { id: userId, organizationId, rol, rutaIds: rutaIdsRaw, country } = session.user
  const esCobrador = rol === 'cobrador'
  const misRutas = rutaIdsRaw ?? []
  const url = new URL(request.url)
  const hoy = hoyIso(country ?? 'co')

  const mes = /^\d{4}-\d{2}$/.test(url.searchParams.get('mes') ?? '') ? url.searchParams.get('mes') : hoy.slice(0, 7)
  const detalle = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get('dia') ?? '') ? url.searchParams.get('dia') : null
  const rutaId = url.searchParams.get('rutaId') || null

  const [y, m] = mes.split('-').map(Number)
  const primero = `${mes}-01`
  const ultimo = diaIso(Date.UTC(y, m, 0, 5))
  const tope = diaIso(Date.UTC(Number(hoy.slice(0, 4)), Number(hoy.slice(5, 7)) - 1 + MESES_ADELANTE + 1, 0, 5))
  if (primero > tope) return Response.json({ error: 'Ese mes queda muy adelante', tope }, { status: 400 })

  const conPasado = await alcanzaElPlan(session)
  const desde = conPasado ? primero : (primero < hoy ? hoy : primero)
  const hasta = ultimo
  if (detalle && (detalle < desde || detalle > hasta)) {
    return Response.json({ error: 'Ese día no está en el calendario', motivo: detalle < hoy && !conPasado ? 'plan' : 'rango' }, { status: 400 })
  }

  // El cobrador ve SUS rutas, y los clientes sin ruta que él creó. Igual que «Cobrar hoy».
  const filtroRuta = esCobrador
    ? { OR: [{ rutaId: { in: misRutas } }, { rutaId: null, creadoPorId: userId }] }
    : {}
  const porRuta = rutaId ? (rutaId === 'sin' ? { rutaId: null } : { rutaId }) : {}
  if (rutaId && rutaId !== 'sin' && esCobrador && !misRutas.includes(rutaId)) {
    return Response.json({ error: 'Esa ruta no es tuya' }, { status: 403 })
  }

  const manana = new Date(fechaDe(hoy).getTime() + 86400000)
  const [org, festivos, rutas, clientes] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
    prisma.ruta.findMany({
      where: { organizationId, ...(esCobrador ? { id: { in: misRutas } } : {}) },
      select: { id: true, nombre: true }, orderBy: { nombre: 'asc' },
    }),
    prisma.cliente.findMany({
      where: { organizationId, estado: { notIn: ['eliminado'] }, AND: [filtroRuta, porRuta] },
      orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
      select: {
        id: true, nombre: true, diasSinCobro: true,
        ruta: { select: { id: true, nombre: true, diasSinCobro: true } },
        prestamos: {
          where: { estado: 'activo', esClavo: false },
          select: {
            id: true, estado: true, esClavo: true, cuotaDiaria: true, montoPrestado: true, ...CAMPOS_DEL_REPARTO,
            totalAPagar: true, totalPagado: true, abonadoCapital: true, frecuencia: true, fechaInicio: true,
            fechaFin: true, diasPlazo: true, diaCobroSemana: true, diaCobroMes: true, diaCobroMes2: true,
            primerCobro: true, diasSinCobro: true, modoInteres: true, sinPlazo: true, capitalExtra: true,
            proximoCobroManual: true, proximoCobroPorInteres: true, interesAdelantado: true,
            devengos: { select: { periodo: true, interes: true } },
            cuotasAmortizacion: {
              select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
              orderBy: { numeroPeriodo: 'asc' },
            },
            pagos: {
              where: { fechaPago: { gte: fechaDe(hoy), lt: manana } },
              select: { montoPagado: true, fechaPago: true, tipo: true, nota: true },
            },
          },
        },
      },
    }),
  ])

  // Lo que lee el cálculo (saldo, al día) va en `pagos`; lo de hoy, en `pagosHoy`.
  const delCalculo = await pagosDelCalculoPorPrestamo(prisma, clientes.flatMap((c) => c.prestamos.map((p) => p.id)))
  for (const c of clientes) {
    for (const p of c.prestamos) { p.pagosHoy = p.pagos; p.pagos = delCalculo.get(p.id) ?? [] }
  }

  // Los pagos de los días pasados del rango: lo cobrado de verdad, también de
  // préstamos que ya se terminaron. Sin recargos ni descuentos; el abono previo
  // va marcado: cubre cuotas pero no es plata cobrada ese día.
  let pagosPasados = []
  const pagadoAntes = new Map()
  if (conPasado && desde < hoy) {
    const ids = clientes.map((c) => c.id)
    /* Lo pagado antes del mes: sin esto, quien pagó por adelantado en octubre salía
       «no pagó» en noviembre. Se suma en la base, no se trae pago por pago. */
    const previos = await prisma.pago.groupBy({
      by: ['prestamoId'],
      where: { organizationId, fechaPago: { lt: fechaDe(desde) }, tipo: { notIn: ['recargo', 'descuento'] }, prestamo: { estado: 'activo', clienteId: { in: ids } } },
      _sum: { montoPagado: true },
    })
    for (const g of previos) pagadoAntes.set(g.prestamoId, Number(g._sum.montoPagado) || 0)
    const pagos = await prisma.pago.findMany({
      where: {
        organizationId,
        fechaPago: { gte: fechaDe(desde), lt: fechaDe(hoy) },
        tipo: { notIn: ['recargo', 'descuento'] },
        prestamo: { clienteId: { in: ids } },
      },
      select: { prestamoId: true, montoPagado: true, fechaPago: true, tipo: true, nota: true, prestamo: { select: { clienteId: true } } },
    })
    const off = Math.abs(getUtcOffset(country ?? 'co'))
    pagosPasados = pagos.map((g) => ({
      prestamoId: g.prestamoId, clienteId: g.prestamo.clienteId, monto: Number(g.montoPagado) || 0,
      previo: esAbonoPrevio(g),
      dia: new Date(new Date(g.fechaPago).getTime() - off * 3600000).toISOString().slice(0, 10),
    }))
  }

  const dias = armarCalendario({ clientes, pagosPasados, pagadoAntes, org, festivos, hoy, desde, hasta, conPasado, detalle })

  return Response.json({
    mes, hoy, desde, hasta, conPasado, tope: tope.slice(0, 7),
    // «Sin ruta» solo tiene sentido para quien ve todo y ya tiene rutas.
    rutas: esCobrador || rutas.length === 0 ? rutas : [...rutas, { id: 'sin', nombre: 'Sin ruta' }],
    dias,
  })
}
