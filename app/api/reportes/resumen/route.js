// app/api/reportes/resumen/route.js
import { NextResponse }  from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'
import { prisma }        from '@/lib/prisma'

// Función para ajustar fecha UTC a Colombia
const toColombiaDate = (date) => new Date(date.getTime() - 5 * 60 * 60 * 1000)

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') // YYYY-MM-DD
  const hasta = searchParams.get('hasta') // YYYY-MM-DD

  const fechaDesde = desde ? new Date(desde + 'T00:00:00-05:00') : toColombiaDate(new Date(new Date().setDate(1)))
  const fechaHasta = hasta ? new Date(hasta + 'T23:59:59-05:00') : toColombiaDate(new Date())

  const [clientes, prestamos, pagos, mora] = await Promise.all([
    // Total clientes activos
    prisma.cliente.count({ where: { organizationId: orgId, estado: 'activo' } }),

    // Préstamos activos vs completados
    prisma.prestamo.groupBy({
      by: ['estado'],
      where: { organizationId: orgId },
      _count: true,
      _sum: { montoPrestado: true, totalAPagar: true },
    }),

    // Pagos en el período
    prisma.pago.aggregate({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lte: fechaHasta },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),

    // Clientes en mora
    prisma.cliente.count({ where: { organizationId: orgId, estado: 'mora' } }),
  ])

  const activos    = prestamos.find((p) => p.estado === 'activo')
  const completados = prestamos.find((p) => p.estado === 'completado')

  return NextResponse.json({
    clientes: {
      total: clientes,
      enMora: mora,
    },
    prestamos: {
      activos:     activos?._count    ?? 0,
      completados: completados?._count ?? 0,
      carteraActiva: activos?._sum?.totalAPagar ?? 0,
      capitalPrestado: activos?._sum?.montoPrestado ?? 0,
    },
    pagos: {
      totalPeriodo: pagos._sum.montoPagado ?? 0,
      cantidad:     pagos._count        ?? 0,
    },
    periodo: { desde: fechaDesde, hasta: fechaHasta },
  })
}
