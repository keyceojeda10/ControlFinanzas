// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

// Obtener fecha actual en timezone Colombia (UTC-5)
function getColombiaDate() {
  return new Date(Date.now() - 5 * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 403 })

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
    clientesTotal,
    clientesMora,
    prestamosActivos,
    prestamosCompletados,
    pagosHoy,
    pagosMes,
    proximosCobros,
  ] = await Promise.all([
    // Clientes totales
    prisma.cliente.count({ where: { organizationId: orgId, estado: { notIn: ['eliminado'] } } }),

    // Clientes en mora
    prisma.cliente.count({ where: { organizationId: orgId, estado: 'mora' } }),

    // Préstamos activos con suma
    prisma.prestamo.aggregate({
      where: { organizationId: orgId, estado: 'activo' },
      _count: true,
      _sum: { montoPrestado: true, totalAPagar: true, cuotaDiaria: true },
    }),

    // Préstamos completados
    prisma.prestamo.count({ where: { organizationId: orgId, estado: 'completado' } }),

    // Pagos de hoy (usar fechas UTC para сравнение con datos en DB)
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: {
          gte: inicioDiaUTC,
          lte: finDiaUTC,
        },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Pagos del mes
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: { gte: inicioMes, lte: finMes },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Últimos 5 pagos registrados
    prisma.pago.findMany({
      where: { organizationId: orgId },
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
  ])

  return NextResponse.json({
    clientes: {
      total:  clientesTotal,
      enMora: clientesMora,
    },
    prestamos: {
      activos:         prestamosActivos._count,
      completados:     prestamosCompletados,
      carteraActiva:   prestamosActivos._sum?.totalAPagar   ?? 0,
      capitalPrestado: prestamosActivos._sum?.montoPrestado ?? 0,
      cuotaDiariaTotal: prestamosActivos._sum?.cuotaDiaria  ?? 0,
    },
    cobros: {
      hoy:         pagosHoy._sum?.montoPagado    ?? 0,
      cantidadHoy: pagosHoy._count              ?? 0,
      mes:         pagosMes._sum?.montoPagado   ?? 0,
      cantidadMes: pagosMes._count              ?? 0,
    },
    ultimosPagos: proximosCobros.map((p) => ({
      id:         p.id,
      cliente:    p.prestamo.cliente.nombre,
      monto:      p.montoPagado,
      fecha:      p.fechaPago,
      tipo:       p.tipo,
    })),
  })
}
