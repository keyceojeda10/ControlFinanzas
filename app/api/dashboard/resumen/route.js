// app/api/dashboard/resumen/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 403 })

  const hoy     = new Date()
  const inicioMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const finMes    = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59)

  const [
    clientesTotal,
    clientesMora,
    prestamosActivos,
    prestamosCompletados,
    pagosHoy,
    pagosMes,
    proximosCobros,
  ] = await Promise.all([
    // Clientes activos
    prisma.cliente.count({ where: { organizationId: orgId, activo: true } }),

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

    // Pagos de hoy
    prisma.pago.aggregate({
      where: {
        organizationId: orgId,
        fechaPago: {
          gte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()),
          lte: new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59),
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
