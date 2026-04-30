// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

// Sin cache: cada request lee BD en vivo. Evita que LiteSpeed o cualquier
// intermediario sirva una respuesta vieja, que es la causa raiz por la que
// algunos clientes ven KPIs "pegados" entre dias.
export const dynamic = 'force-dynamic'
export const revalidate = 0

// Obtener fecha actual en timezone Colombia (UTC-5)
function getColombiaDate() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 403 })

  // Cobrador: limitar metricas a clientes/prestamos/pagos de SU ruta
  const esCobrador = session.user.rol === 'cobrador'
  const rutaIdsCobrador = session.user.rutaIds ?? []
  const filtroRutaCliente = esCobrador ? { rutaId: { in: rutaIdsCobrador } } : {}
  const filtroRutaPagos = esCobrador
    ? { prestamo: { cliente: { rutaId: { in: rutaIdsCobrador } } } }
    : {}

  // Rangos UTC que representan "hoy" y "este mes" en hora Colombia (UTC-5)
  // Colombia midnight = UTC 05:00. Fin del día Colombia = UTC 04:59:59 del día siguiente.
  const hoy = getColombiaDate()
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()
  const inicioDiaUTC = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC    = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))
  const inicioMes    = new Date(Date.UTC(y, m, 1, 5, 0, 0))
  const finMes       = new Date(Date.UTC(y, m + 1, 1, 4, 59, 59))
  // Rango de ayer Colombia: para comparativos vs ayer
  const inicioAyerUTC = new Date(Date.UTC(y, m, d - 1, 5, 0, 0))
  const finAyerUTC    = new Date(Date.UTC(y, m, d, 4, 59, 59))

  const [
    org,
    prestamosActivosDetalle,
    prestamosCompletados,
    pagosHoy,
    pagosMes,
    ultimosPagos,
    rutasActivas,
    capitalRow,
    gastosMesAgg,
    pagosAyer,
    pagosHoyPorCobrador,
    prestamosHoy,
    gastosHoy,
    movimientosHoy,
    clientesSinRutaCount,
    clientesSinPagosLargo,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { diasSinCobro: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: {
          estado: { notIn: ['eliminado', 'inactivo'] },
          ...filtroRutaCliente,
        },
      },
      select: {
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        cuotaDiaria: true,
        fechaInicio: true,
        diasPlazo: true,
        frecuencia: true,
        estado: true,
        pagos: { select: { montoPagado: true, tipo: true } },
        cliente: {
          select: {
            id: true,
            diasSinCobro: true,
            ruta: { select: { diasSinCobro: true } },
          },
        },
      },
    }),

    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'completado',
        ...(esCobrador ? { cliente: { rutaId: { in: rutaIdsCobrador } } } : {}),
      },
    }),

    // Pagos de hoy (excluye recargos/descuentos — son ajustes contables, no efectivo)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: {
          gte: inicioDiaUTC,
          lte: finDiaUTC,
        },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Pagos del mes (excluye recargos/descuentos)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Últimos 5 pagos registrados
    prisma.pago.findMany({
      where: { organizationId: orgId, ...filtroRutaPagos },
      orderBy: { fechaPago: 'desc' },
      take: 5,
      select: {
        id: true,
        montoPagado: true,
        fechaPago: true,
        tipo: true,
        prestamo: {
          select: {
            cliente: { select: { nombre: true } },
          },
        },
      },
    }),

    prisma.ruta.count({
      where: {
        organizationId: orgId,
        activo: true,
        ...(esCobrador ? { id: { in: rutaIdsCobrador } } : {}),
      },
    }),

    // Saldo de capital actual (caja disponible). Solo para owner/superadmin.
    esCobrador ? Promise.resolve(null) : prisma.capital.findFirst({
      where: { organizationId: orgId },
      select: { saldo: true },
    }),

    // Gastos del mes. Solo para owner/superadmin.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioMes, lte: finMes },
      },
      _sum: { monto: true },
    }),

    // Pagos de AYER (para comparativo vs hoy)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioAyerUTC, lte: finAyerUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
        ...filtroRutaPagos,
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Desglose de pagos de hoy POR COBRADOR (solo owner; cobrador ya ve solo lo suyo)
    esCobrador ? Promise.resolve([]) : prisma.pago.groupBy({
      by: ['cobradorId'],
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Préstamos creados hoy (para "lo que pasó hoy")
    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: inicioDiaUTC, lte: finDiaUTC },
        ...(esCobrador ? { cliente: { rutaId: { in: rutaIdsCobrador } } } : {}),
      },
      select: {
        id: true,
        montoPrestado: true,
        totalAPagar: true,
        cliente: { select: { nombre: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),

    // Gastos de hoy. Solo owner.
    esCobrador ? Promise.resolve(null) : prisma.gastoMenor.aggregate({
      where: {
        organizationId: orgId,
        fecha: { gte: inicioDiaUTC, lte: finDiaUTC },
      },
      _sum: { monto: true },
      _count: true,
    }),

    // Movimientos de capital hoy (retiros e inyecciones). Solo owner.
    esCobrador ? Promise.resolve([]) : prisma.movimientoCapital.findMany({
      where: {
        organizationId: orgId,
        createdAt: { gte: inicioDiaUTC, lte: finDiaUTC },
        tipo: { in: ['retiro', 'inyeccion'] },
      },
      select: { tipo: true, monto: true, descripcion: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),

    // Alerta: clientes activos sin ruta asignada. Solo owner.
    esCobrador ? Promise.resolve(0) : prisma.cliente.count({
      where: {
        organizationId: orgId,
        rutaId: null,
        estado: { notIn: ['eliminado', 'inactivo'] },
        prestamos: { some: { estado: 'activo' } },
      },
    }),

    // Alerta: prestamos activos sin pagos hace +7 dias (clientes "abandonados")
    prisma.prestamo.count({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: {
          estado: { notIn: ['eliminado', 'inactivo'] },
          ...filtroRutaCliente,
        },
        OR: [
          { pagos: { none: {} } },
          { pagos: { every: { fechaPago: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } } },
        ],
      },
    }),
  ])

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  let saldoPorCobrar = 0
  let capitalPrestado = 0
  let cuotaDiariaTotal = 0

  for (const p of prestamosActivosDetalle) {
    clientesActivos.add(p.clienteId)
    // Cartera activa = totalAPagar (capital + intereses esperados). Lo que va
    // a entrar a la organizacion cuando se cobre todo. NO es saldo pendiente.
    carteraActiva += p.totalAPagar ?? 0
    // Saldo por cobrar = saldo pendiente real (totalAPagar - pagado, sin recargos/descuentos).
    saldoPorCobrar += calcularSaldoPendiente(p)
    capitalPrestado += p.montoPrestado ?? 0
    cuotaDiariaTotal += p.cuotaDiaria ?? 0

    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) {
      clientesMora.add(p.clienteId)
    }
  }

  // Patrimonio = saldo pendiente real por cobrar + caja disponible - gastos del mes.
  // Refleja "cuanto va a tener al final" descontando los gastos que ya hizo este mes.
  const cajaDisponible = capitalRow?.saldo ?? 0
  const gastosMes = gastosMesAgg?._sum?.monto ?? 0
  const patrimonio = esCobrador ? null : (saldoPorCobrar + cajaDisponible - gastosMes)

  // Mapear cobradorIds a nombres para el desglose de hoy
  const cobradorIds = (pagosHoyPorCobrador || []).map(g => g.cobradorId).filter(Boolean)
  const cobradores = cobradorIds.length > 0
    ? await prisma.user.findMany({
        where: { id: { in: cobradorIds }, organizationId: orgId },
        select: { id: true, nombre: true },
      })
    : []
  const nombrePorId = new Map(cobradores.map(c => [c.id, c.nombre]))
  const desgloseCobradores = (pagosHoyPorCobrador || [])
    .map(g => ({
      cobradorId: g.cobradorId,
      nombre: g.cobradorId ? (nombrePorId.get(g.cobradorId) || 'Cobrador eliminado') : 'Sin asignar',
      pagos: g._count,
      monto: g._sum?.montoPagado ?? 0,
    }))
    .sort((a, b) => b.monto - a.monto)

  // Totales del dia para "lo que paso hoy"
  const prestamosHoyMontoTotal = prestamosHoy.reduce((acc, p) => acc + (p.montoPrestado ?? 0), 0)
  const retirosHoyMonto = (movimientosHoy || []).filter(m => m.tipo === 'retiro').reduce((a, m) => a + m.monto, 0)
  const inyeccionesHoyMonto = (movimientosHoy || []).filter(m => m.tipo === 'inyeccion').reduce((a, m) => a + m.monto, 0)
  const gastosHoyMonto = gastosHoy?._sum?.monto ?? 0
  const gastosHoyCount = gastosHoy?._count ?? 0

  // Comparativos vs ayer
  const cobrosAyerMonto = pagosAyer?._sum?.montoPagado ?? 0
  const cobrosAyerCount = pagosAyer?._count ?? 0

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    clientes: {
      total:  clientesActivos.size,
      enMora: clientesMora.size,
    },
    prestamos: {
      activos:         prestamosActivosDetalle.length,
      completados:     prestamosCompletados,
      carteraActiva:   carteraActiva,
      saldoPorCobrar:  saldoPorCobrar,
      capitalPrestado: capitalPrestado,
      cuotaDiariaTotal: cuotaDiariaTotal,
    },
    finanzas: esCobrador ? null : {
      cajaDisponible,
      gastosMes,
      patrimonio,
    },
    cobros: {
      hoy:         pagosHoy._sum?.montoPagado    ?? 0,
      cantidadHoy: pagosHoy._count              ?? 0,
      mes:         pagosMes._sum?.montoPagado   ?? 0,
      cantidadMes: pagosMes._count              ?? 0,
      ayer:        cobrosAyerMonto,
      cantidadAyer: cobrosAyerCount,
    },
    rutas: {
      activas: rutasActivas ?? 0,
    },
    ultimosPagos: ultimosPagos.map((p) => ({
      id:         p.id,
      cliente:    p.prestamo.cliente.nombre,
      monto:      p.montoPagado,
      fecha:      p.fechaPago,
      tipo:       p.tipo,
    })),
    // Nuevo: resumen completo del dia (lo que paso hoy)
    actividadHoy: {
      pagos: {
        cantidad: pagosHoy._count ?? 0,
        monto: pagosHoy._sum?.montoPagado ?? 0,
      },
      prestamos: {
        cantidad: prestamosHoy.length,
        monto: prestamosHoyMontoTotal,
        lista: prestamosHoy.slice(0, 5).map(p => ({
          id: p.id,
          cliente: p.cliente?.nombre ?? '—',
          monto: p.montoPrestado,
          totalAPagar: p.totalAPagar,
        })),
      },
      gastos: esCobrador ? null : {
        cantidad: gastosHoyCount,
        monto: gastosHoyMonto,
      },
      retiros: esCobrador ? null : {
        monto: retirosHoyMonto,
      },
      inyecciones: esCobrador ? null : {
        monto: inyeccionesHoyMonto,
      },
      desgloseCobradores: esCobrador ? null : desgloseCobradores,
    },
    // Nuevo: alertas que necesitan atencion del owner
    alertas: esCobrador ? null : {
      clientesSinRuta: clientesSinRutaCount ?? 0,
      prestamosSinPagosLargo: clientesSinPagosLargo ?? 0,
      mora30plus: 0, // Se completa en el cliente con moraData
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
