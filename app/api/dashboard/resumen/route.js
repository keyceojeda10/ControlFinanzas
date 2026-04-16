// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

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
  const rutaIdCobrador = session.user.rutaId ?? null
  const filtroRutaCliente = esCobrador ? { rutaId: rutaIdCobrador } : {}
  const filtroRutaPagos = esCobrador
    ? { prestamo: { cliente: { rutaId: rutaIdCobrador } } }
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
        ...(esCobrador ? { cliente: { rutaId: rutaIdCobrador } } : {}),
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
        ...(esCobrador ? { id: rutaIdCobrador } : {}),
      },
    }),
  ])

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  let capitalPrestado = 0
  let cuotaDiariaTotal = 0

  for (const p of prestamosActivosDetalle) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    capitalPrestado += p.montoPrestado ?? 0
    cuotaDiariaTotal += p.cuotaDiaria ?? 0

    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) {
      clientesMora.add(p.clienteId)
    }
  }

  return NextResponse.json({
    clientes: {
      total:  clientesActivos.size,
      enMora: clientesMora.size,
    },
    prestamos: {
      activos:         prestamosActivosDetalle.length,
      completados:     prestamosCompletados,
      carteraActiva:   carteraActiva,
      capitalPrestado: capitalPrestado,
      cuotaDiariaTotal: cuotaDiariaTotal,
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
  })
}
