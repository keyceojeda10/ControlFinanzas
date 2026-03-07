// app/api/reportes/resumen/route.js
import { NextResponse }  from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'
import { prisma }        from '@/lib/prisma'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5

// Convierte una fecha YYYY-MM-DD de Colombia a rango UTC
const getColombiaDayRange = (fechaColombia) => {
  const inicio = new Date(fechaColombia + 'T00:00:00-05:00')
  const fin    = new Date(fechaColombia + 'T23:59:59.999-05:00')
  return { inicio, fin }
}

const toColombiaDate = (date) => new Date(date.getTime() - COLOMBIA_OFFSET)

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde') // YYYY-MM-DD
  const hasta = searchParams.get('hasta') // YYYY-MM-DD

  let fechaDesde, fechaHasta
  
  if (desde && hasta) {
    const rangeDesde = getColombiaDayRange(desde)
    const rangeHasta = getColombiaDayRange(hasta)
    fechaDesde = rangeDesde.inicio
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
  } else {
    // Default: inicio del mes en Colombia
    const ahoraColombia = new Date(Date.now() - COLOMBIA_OFFSET)
    const primerDiaMes = new Date(ahoraColombia.getFullYear(), ahoraColombia.getMonth(), 1)
    const fechaIniColombia = primerDiaMes.toISOString().slice(0, 10)
    const rangeIni = getColombiaDayRange(fechaIniColombia)
    fechaDesde = rangeIni.inicio
    
    const fechaFinColombia = ahoraColombia.toISOString().slice(0, 10)
    const rangeFin = getColombiaDayRange(fechaFinColombia)
    fechaHasta = new Date(rangeFin.fin.getTime() + 1)
  }

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
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
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
    periodo: { desde: desde ?? fechaDesde.toISOString().slice(0, 10), hasta: hasta ?? fechaHasta.toISOString().slice(0, 10) },
  })
}
