// app/api/caja/cobrador/[id]/route.js
// Caja detallada de UN cobrador para una fecha: lo que prestó, lo que cobró, los
// seguros que generó, sus gastos, el efectivo que maneja hoy, el capital que le
// queda a cada una de sus rutas, y la línea de movimientos del día (cobros +
// préstamos entregados + gastos). Solo accesible por el owner de la organización.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const TIPOS_AJUSTE_PAGO = ['recargo', 'descuento']

// Lista deduplicada de préstamos que el cobrador entregó en el día, con cliente,
// monto REAL desembolsado (no montoPrestado, porque en renovaciones el monto del
// MovimientoCapital ya descuenta el saldo absorbido), ruta y hora.
// rutaIds: IDs de las rutas activas del cobrador (para capturar desembolsos hechos
// por el owner en nombre del cobrador — en esos casos creadoPorId es el owner, no el cobrador).
async function getDesembolsosCobradorDia(organizationId, inicio, fin, cobradorId, rutaIds = []) {
  // Fuente primaria: MovimientoCapital de tipo desembolso — tiene el monto real.
  // En renovaciones = diferencia entregada en mano; en préstamos nuevos = montoPrestado.
  // Busca por creadoPorId (cobrador creó) OR rutaId (movimiento pertenece a su ruta,
  // aunque lo haya creado el owner).
  const [movimientos, prestamosRutaDia] = await Promise.all([
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        OR: [
          { creadoPorId: cobradorId },
          ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ],
      },
      select: { referenciaId: true, monto: true, rutaId: true, createdAt: true },
    }),
    // Préstamos de la ruta del cobrador en el día (para detectar los que no tienen
    // MovimientoCapital — orgs sin capital configurado — y también para obtener nombres).
    prisma.prestamo.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
        cliente: { ruta: { cobradorId } },
      },
      select: {
        id: true,
        montoPrestado: true,
        createdAt: true,
        cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
      },
    }),
  ])

  // Mapa de préstamo ID → monto real del MovimientoCapital
  const montoRealPorPrestamo = new Map()
  for (const m of movimientos) {
    if (m.referenciaId) montoRealPorPrestamo.set(m.referenciaId, { monto: m.monto, rutaId: m.rutaId, fecha: m.createdAt })
  }

  // También buscar préstamos fuera de la ruta que el cobrador creó (via MovimientoCapital)
  const idsEnRuta = new Set(prestamosRutaDia.map((p) => p.id))
  const idsExtraConMovimiento = [...montoRealPorPrestamo.keys()].filter((id) => !idsEnRuta.has(id))
  let prestamosExtra = []
  if (idsExtraConMovimiento.length > 0) {
    prestamosExtra = await prisma.prestamo.findMany({
      where: { organizationId, id: { in: idsExtraConMovimiento }, estado: { not: 'cancelado' } },
      select: {
        id: true,
        montoPrestado: true,
        createdAt: true,
        cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
      },
    })
  }

  const vistos = new Set()
  const items = []

  const agregar = (p, montoOverride) => {
    if (!p || vistos.has(p.id)) return
    vistos.add(p.id)
    const mov = montoRealPorPrestamo.get(p.id)
    items.push({
      tipo: 'prestamo',
      id: p.id,
      // Usa el monto del MovimientoCapital si existe (correcto en renovaciones),
      // o el montoPrestado como fallback (orgs sin capital configurado).
      monto: mov?.monto ?? montoOverride ?? p.montoPrestado,
      cliente: p.cliente?.nombre || null,
      clienteCedula: p.cliente?.cedula || null,
      rutaId: p.cliente?.ruta?.id || mov?.rutaId || null,
      rutaNombre: p.cliente?.ruta?.nombre || null,
      fecha: mov?.fecha || p.createdAt,
    })
  }

  for (const p of prestamosRutaDia) agregar(p)
  for (const p of prestamosExtra) agregar(p)

  return items
}

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Solo el owner ve la caja detallada de otro cobrador.
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver la caja por cobrador' }, { status: 403 })
  }

  const { organizationId, country = 'co' } = session.user
  const { id: cobradorId } = await params
  const { searchParams } = new URL(request.url)
  // Soporta día único (?fecha=) o rango histórico acumulado (?desde=&hasta=).
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')
  const FECHA_RX = /^\d{4}-\d{2}-\d{2}$/
  const esRango = desdeParam && hastaParam && FECHA_RX.test(desdeParam) && FECHA_RX.test(hastaParam)
  const fechaBase = searchParams.get('fecha') || getLocalDateStr(country)
  const { inicio } = esRango ? getLocalDayRange(desdeParam, country) : getLocalDayRange(fechaBase, country)
  const { fin }    = esRango ? getLocalDayRange(hastaParam, country) : getLocalDayRange(fechaBase, country)

  // Validar que el cobrador pertenezca a la organización.
  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId, rol: 'cobrador' },
    select: { id: true, nombre: true },
  })
  if (!cobrador) {
    return Response.json({ error: 'Cobrador no encontrado' }, { status: 404 })
  }

  // Obtener rutas primero para pasarlas a getDesembolsosCobradorDia y capturar
  // desembolsos hechos por el owner en rutas del cobrador (creadoPorId = owner).
  const rutas = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true, nombre: true, saldoCapital: true },
    orderBy: { orden: 'asc' },
  })
  const rutaIds = rutas.map((r) => r.id)

  const [cobros, gastos, desembolsos, cierre, recargos] = await Promise.all([
    // Cobros del día: pagos reales (excluye ajustes) hechos por el cobrador.
    prisma.pago.findMany({
      where: {
        cobradorId,
        fechaPago: { gte: inicio, lt: fin },
        tipo: { notIn: TIPOS_AJUSTE_PAGO },
        prestamo: { organizationId },
      },
      select: {
        montoPagado: true,
        fechaPago: true,
        prestamo: {
          select: {
            esClavo: true,
            cliente: { select: { nombre: true, cedula: true, ruta: { select: { id: true, nombre: true } } } },
          },
        },
      },
      orderBy: { fechaPago: 'asc' },
    }),
    prisma.gastoMenor.findMany({
      where: { organizationId, cobradorId, estado: { in: ['pendiente', 'aprobado'] }, fecha: { gte: inicio, lt: fin } },
      select: { monto: true, description: true, fecha: true, estado: true },
      orderBy: { fecha: 'asc' },
    }),
    getDesembolsosCobradorDia(organizationId, inicio, fin, cobradorId, rutaIds),
    prisma.cierreCaja.findFirst({
      where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } },
      select: { id: true },
    }),
    // Recargos aplicados por el cobrador en el día
    prisma.pago.aggregate({
      where: {
        cobradorId,
        fechaPago: { gte: inicio, lt: fin },
        tipo: 'recargo',
        prestamo: { organizationId },
      },
      _sum: { montoPagado: true },
      _count: { id: true },
    }),
  ])

  // Totales del día.
  const cobradoDia = Math.round(cobros.reduce((a, p) => a + (p.montoPagado || 0), 0))
  const prestadoDia = Math.round(desembolsos.reduce((a, d) => a + (d.monto || 0), 0))
  const gastosDia = Math.round(gastos.reduce((a, g) => a + (g.monto || 0), 0))
  const efectivoDia = cobradoDia - prestadoDia - gastosDia
  const capitalRutasTotal = Math.round(rutas.reduce((a, r) => a + (r.saldoCapital || 0), 0))
  const recargosMontoTotal = Math.round(recargos._sum?.montoPagado || 0)
  const recargosCantidad = recargos._count?.id || 0

  // Desglose por ruta: prestado / cobrado / seguros + saldoCapital de la ruta.
  // Los seguros se generan al crear el préstamo, así que se cuentan junto al desembolso.
  const porRutaMap = new Map(
    rutas.map((r) => [r.id, {
      rutaId: r.id,
      nombre: r.nombre,
      saldoCapital: Math.round(r.saldoCapital || 0),
      prestadoDia: 0,
      cobradoDia: 0,
      segurosDia: 0,
    }])
  )
  const bucket = (rutaId) => {
    if (rutaId && porRutaMap.has(rutaId)) return porRutaMap.get(rutaId)
    // Movimientos de clientes fuera de las rutas del cobrador (ej. préstamo creado a
    // un cliente de otra ruta): se agrupan en "Otros" para no perderlos.
    if (!porRutaMap.has('__otros__')) {
      porRutaMap.set('__otros__', { rutaId: null, nombre: 'Otros', saldoCapital: 0, prestadoDia: 0, cobradoDia: 0, segurosDia: 0 })
    }
    return porRutaMap.get('__otros__')
  }

  for (const d of desembolsos) bucket(d.rutaId).prestadoDia += d.monto || 0
  for (const p of cobros) bucket(p.prestamo?.cliente?.ruta?.id).cobradoDia += p.montoPagado || 0

  // Seguros del día por ruta (préstamos con seguro creados hoy). Se consulta aparte
  // para tener el montoSeguro real por préstamo.
  const segurosHoy = await prisma.prestamo.findMany({
    where: {
      organizationId,
      seguro: true,
      montoSeguro: { gt: 0 },
      createdAt: { gte: inicio, lt: fin },
      estado: { not: 'cancelado' },
      id: { in: desembolsos.map((d) => d.id) },
    },
    select: { id: true, montoSeguro: true, cliente: { select: { ruta: { select: { id: true } } } } },
  })
  let segurosDiaTotal = 0
  for (const s of segurosHoy) {
    segurosDiaTotal += s.montoSeguro || 0
    bucket(s.cliente?.ruta?.id).segurosDia += s.montoSeguro || 0
  }

  const porRuta = [...porRutaMap.values()].map((r) => ({
    ...r,
    prestadoDia: Math.round(r.prestadoDia),
    cobradoDia: Math.round(r.cobradoDia),
    segurosDia: Math.round(r.segurosDia),
  }))

  // Línea de movimientos del día: cobros + préstamos + gastos, ordenados por hora.
  const movimientos = [
    ...cobros.map((p) => ({
      tipo: 'cobro',
      monto: Math.round(p.montoPagado || 0),
      cliente: p.prestamo?.cliente?.nombre || null,
      clienteCedula: p.prestamo?.cliente?.cedula || null,
      rutaNombre: p.prestamo?.cliente?.ruta?.nombre || null,
      esClavo: !!p.prestamo?.esClavo,
      fecha: p.fechaPago,
    })),
    ...desembolsos.map((d) => ({
      tipo: 'prestamo',
      monto: Math.round(d.monto || 0),
      cliente: d.cliente,
      clienteCedula: d.clienteCedula,
      rutaNombre: d.rutaNombre,
      esClavo: false,
      fecha: d.fecha,
    })),
    // Los gastos NO se listan en los movimientos de caja (tienen su propio apartado
    // en el menú). Sí siguen contando en el cálculo del efectivo del día (arriba).
  ].sort((a, b) => new Date(a.fecha) - new Date(b.fecha))

  return Response.json({
    cobrador: { id: cobrador.id, nombre: cobrador.nombre },
    fecha: esRango ? null : fechaBase,
    esRango,
    desde: esRango ? desdeParam : null,
    hasta: esRango ? hastaParam : null,
    // El cierre es diario; en rango no aplica un único estado de cierre.
    cerrado: esRango ? null : !!cierre,
    resumen: {
      cobradoDia,
      prestadoDia,
      segurosDia: Math.round(segurosDiaTotal),
      gastosDia,
      efectivoDia,
      capitalRutasTotal,
      recargosMonto: recargosMontoTotal,
      recargosCantidad,
    },
    porRuta,
    movimientos,
    gastos: gastos.map((g) => ({
      description: g.description,
      monto: Math.round(g.monto || 0),
      fecha: g.fecha,
      estado: g.estado,
    })),
  })
}
