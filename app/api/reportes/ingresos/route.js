// app/api/reportes/ingresos/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const COLOMBIA_OFFSET = 5 * 60 * 60 * 1000 // UTC-5

// Convierte una fecha YYYY-MM-DD de Colombia a rango UTC
const getColombiaDayRange = (fechaColombia) => {
  const inicio = new Date(fechaColombia + 'T00:00:00-05:00')
  const fin    = new Date(fechaColombia + 'T23:59:59.999-05:00')
  return { inicio, fin }
}

// Ajusta fecha UTC a Colombia para mostrar
const toColombiaDate = (date) => new Date(date.getTime() - COLOMBIA_OFFSET)

// Función para formatear fecha a YYYY-MM-DD en hora de Colombia
const formatColombiaDate = (date) => {
  const d = toColombiaDate(new Date(date))
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') ?? 'diario' // diario | semanal | mensual
  const desde   = searchParams.get('desde')
  const hasta   = searchParams.get('hasta')

  // Obtener rango de fechas en UTC
  let fechaDesde, fechaHasta
  
  if (desde && hasta) {
    const rangeDesde = getColombiaDayRange(desde)
    const rangeHasta = getColombiaDayRange(hasta)
    fechaDesde = rangeDesde.inicio
    // Para "hasta", queremos incluir todo el día
    fechaHasta = new Date(rangeHasta.fin.getTime() + 1)
  } else {
    // Default: últimos 30 días desde hoy en Colombia
    const ahoraColombia = new Date(Date.now() - COLOMBIA_OFFSET)
    const fechaFinColombia = ahoraColombia.toISOString().slice(0, 10)
    const rangeFin = getColombiaDayRange(fechaFinColombia)
    fechaHasta = new Date(rangeFin.fin.getTime() + 1)
    
    const fechaIniColombia = new Date(ahoraColombia.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const rangeIni = getColombiaDayRange(fechaIniColombia)
    fechaDesde = rangeIni.inicio
  }

  const pagos = await prisma.pago.findMany({
    where: {
      prestamo: { organizationId: orgId },
      fechaPago: { gte: fechaDesde, lt: fechaHasta },
    },
    select: { montoPagado: true, fechaPago: true },
    orderBy: { fechaPago: 'asc' },
  })

  // Agrupar por período - ajustar a Colombia
  const grupos = {}
  for (const p of pagos) {
    let key
    const f = toColombiaDate(new Date(p.fechaPago))
    if (periodo === 'mensual') {
      key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    } else if (periodo === 'semanal') {
      const startOfYear = new Date(f.getFullYear(), 0, 1)
      const week = Math.ceil(((f - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      key = `${f.getFullYear()}-S${String(week).padStart(2, '0')}`
    } else {
      key = formatColombiaDate(p.fechaPago)
    }
    grupos[key] = (grupos[key] ?? 0) + p.montoPagado
  }

  const data = Object.entries(grupos).map(([fecha, total]) => ({ fecha, total }))

  return NextResponse.json({ periodo, data, desde: desde ?? fechaDesde.toISOString().slice(0, 10), hasta: hasta ?? fechaHasta.toISOString().slice(0, 10) })
}
