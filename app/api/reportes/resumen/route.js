// app/api/reportes/resumen/route.js
import { NextResponse }  from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }   from '@/lib/auth'
import { prisma }        from '@/lib/prisma'
import { calcularDiasMora } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

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
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
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

  const [org, prestamosActivosDetalle, prestamosCompletados, pagos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { diasSinCobro: true },
    }),

    prisma.prestamo.findMany({
      where: {
        organizationId: orgId,
        estado: 'activo',
        cliente: { estado: { notIn: ['eliminado', 'inactivo'] } },
      },
      select: {
        clienteId: true,
        montoPrestado: true,
        totalAPagar: true,
        fechaInicio: true,
        diasPlazo: true,
        cuotaDiaria: true,
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

    prisma.prestamo.count({ where: { organizationId: orgId, estado: 'completado' } }),

    // Pagos en el período (excluir ajustes)
    prisma.pago.aggregate({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lt: fechaHasta },
        tipo: { notIn: ['recargo', 'descuento'] },
      },
      _sum: { montoPagado: true },
      _count: true,
    }),
  ])

  const clientesActivos = new Set()
  const clientesMora = new Set()
  let carteraActiva = 0
  let capitalPrestado = 0

  for (const p of prestamosActivosDetalle) {
    clientesActivos.add(p.clienteId)
    carteraActiva += p.totalAPagar ?? 0
    capitalPrestado += p.montoPrestado ?? 0

    const diasExcluidos = obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org)
    if (calcularDiasMora(p, diasExcluidos) > 0) {
      clientesMora.add(p.clienteId)
    }
  }

  return NextResponse.json({
    clientes: {
      total: clientesActivos.size,
      enMora: clientesMora.size,
    },
    prestamos: {
      activos:     prestamosActivosDetalle.length,
      completados: prestamosCompletados,
      carteraActiva,
      capitalPrestado,
    },
    pagos: {
      totalPeriodo: pagos._sum.montoPagado ?? 0,
      cantidad:     pagos._count        ?? 0,
    },
    periodo: { desde: desde ?? fechaDesde.toISOString().slice(0, 10), hasta: hasta ?? fechaHasta.toISOString().slice(0, 10) },
  })
}
