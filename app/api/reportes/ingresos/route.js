// app/api/reportes/ingresos/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const periodo = searchParams.get('periodo') ?? 'diario' // diario | semanal | mensual
  const desde   = searchParams.get('desde')
  const hasta   = searchParams.get('hasta')

  // Default: últimos 30 días
  const fechaHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date()
  const fechaDesde = desde
    ? new Date(desde)
    : new Date(fechaHasta.getTime() - 30 * 24 * 60 * 60 * 1000)

  const pagos = await prisma.pago.findMany({
    where: {
      prestamo: { organizationId: orgId },
      fechaPago: { gte: fechaDesde, lte: fechaHasta },
    },
    select: { monto: true, fechaPago: true },
    orderBy: { fechaPago: 'asc' },
  })

  // Agrupar por período
  const grupos = {}
  for (const p of pagos) {
    let key
    const f = new Date(p.fechaPago)
    if (periodo === 'mensual') {
      key = `${f.getFullYear()}-${String(f.getMonth() + 1).padStart(2, '0')}`
    } else if (periodo === 'semanal') {
      // Semana ISO: año + número de semana
      const startOfYear = new Date(f.getFullYear(), 0, 1)
      const week = Math.ceil(((f - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7)
      key = `${f.getFullYear()}-S${String(week).padStart(2, '0')}`
    } else {
      key = f.toISOString().slice(0, 10)
    }
    grupos[key] = (grupos[key] ?? 0) + p.monto
  }

  const data = Object.entries(grupos).map(([fecha, total]) => ({ fecha, total }))

  return NextResponse.json({ periodo, data, desde: fechaDesde, hasta: fechaHasta })
}
