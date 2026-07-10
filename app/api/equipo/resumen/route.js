import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getUtcOffset }     from '@/lib/i18n'

export const dynamic = 'force-dynamic'

function getLocalDate(country = 'co') {
  return new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización' }, { status: 403 })

  if (session.user.rol === 'cobrador') {
    return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  }

  const country = session.user.country ?? 'co'
  const hoy = getLocalDate(country)
  const y = hoy.getUTCFullYear()
  const m = hoy.getUTCMonth()
  const d = hoy.getUTCDate()
  const inicioDiaUTC = new Date(Date.UTC(y, m, d, 5, 0, 0))
  const finDiaUTC    = new Date(Date.UTC(y, m, d + 1, 4, 59, 59))

  const cobradores = await prisma.user.findMany({
    where: { organizationId: orgId, rol: 'cobrador', activo: true },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    select: {
      id: true,
      nombre: true,
      avatarId: true,
      lastActivityAt: true,
      rutas: { where: { activo: true }, select: { id: true, nombre: true } },
    },
    orderBy: { orden: 'asc' },
  })

  if (cobradores.length === 0) {
    return NextResponse.json({ cobradores: [] })
  }

  const cobradorIds = cobradores.map(c => c.id)

  const [pagosHoy, cierresHoy] = await Promise.all([
    prisma.pago.groupBy({
      by: ['cobradorId'],
      where: {
        organizationId: orgId,
        cobradorId: { in: cobradorIds },
        fechaPago: { gte: inicioDiaUTC, lte: finDiaUTC },
        prestamo: { estado: { not: 'cancelado' } },
      },
      _sum: { montoPagado: true },
      _count: { id: true },
    }),
    prisma.cierreCaja.findMany({
      where: {
        organizationId: orgId,
        cobradorId: { in: cobradorIds },
        fecha: { gte: inicioDiaUTC, lte: finDiaUTC },
      },
      select: { cobradorId: true, diferencia: true, createdAt: true },
    }),
  ])

  const pagosMap = {}
  for (const p of pagosHoy) {
    pagosMap[p.cobradorId] = { monto: p._sum.montoPagado || 0, cantidad: p._count.id || 0 }
  }
  const cierreMap = {}
  for (const c of cierresHoy) {
    cierreMap[c.cobradorId] = { diferencia: c.diferencia, cerradoEn: c.createdAt }
  }

  const result = cobradores.map(c => {
    const pago = pagosMap[c.id] || { monto: 0, cantidad: 0 }
    const cierre = cierreMap[c.id] || null
    const minutesSinceActivity = c.lastActivityAt
      ? Math.round((Date.now() - new Date(c.lastActivityAt).getTime()) / 60000)
      : null

    return {
      id: c.id,
      nombre: c.nombre,
      avatarId: c.avatarId,
      rutas: c.rutas.map(r => r.nombre),
      recaudadoHoy: pago.monto,
      pagosHoy: pago.cantidad,
      cajaCerrada: !!cierre,
      cajaDiferencia: cierre?.diferencia ?? null,
      minutesSinceActivity,
      lastActivityAt: c.lastActivityAt,
    }
  })

  return NextResponse.json({ cobradores: result })
}
