import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const dias = parseInt(searchParams.get('dias') || '30')
  const desde = new Date(Date.now() - dias * 86400000)

  const [totalRegistros, porEstado, conSuscripcionActiva, porFuente, registrosPorDia] = await Promise.all([
    prisma.organization.count({ where: { createdAt: { gte: desde } } }),
    prisma.organization.groupBy({
      by: ['estadoContacto'],
      where: { createdAt: { gte: desde } },
      _count: true
    }),
    prisma.organization.count({
      where: { createdAt: { gte: desde }, suscripciones: { some: { estado: 'activa' } } }
    }),
    prisma.organization.groupBy({
      by: ['fuenteRegistro'],
      where: { createdAt: { gte: desde } },
      _count: true
    }),
    prisma.$queryRaw`
      SELECT DATE(createdAt) as fecha, COUNT(*) as total
      FROM Organization
      WHERE createdAt >= ${desde}
      GROUP BY DATE(createdAt)
      ORDER BY fecha
    `
  ])

  const estadoMap = {}
  porEstado.forEach(e => { estadoMap[e.estadoContacto] = e._count })

  const fuenteMap = {}
  porFuente.forEach(f => { fuenteMap[f.fuenteRegistro || 'sin_fuente'] = f._count })

  return NextResponse.json({
    totalRegistros,
    porEstado: estadoMap,
    conSuscripcionActiva,
    tasaConversion: totalRegistros > 0 ? ((conSuscripcionActiva / totalRegistros) * 100).toFixed(1) : 0,
    porFuente: fuenteMap,
    registrosPorDia: registrosPorDia.map(r => ({
      fecha: r.fecha,
      total: Number(r.total)
    }))
  })
}
