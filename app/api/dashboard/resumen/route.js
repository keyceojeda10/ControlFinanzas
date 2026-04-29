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
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0',
    },
  })
}
