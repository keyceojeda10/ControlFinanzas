import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  try {
    const session = await getServerSession(authOptions)
    if (session?.user?.rol !== 'superadmin') {
      return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const estado = searchParams.get('estado')
    const q = searchParams.get('q')
    const desde = searchParams.get('desde')

    const where = {}
    if (estado && estado !== 'todos') where.estado = estado
    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { telefono: { contains: q } },
      ]
    }
    if (desde) where.createdAt = { gte: new Date(desde) }

    const [leads, stats] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: {
          organization: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 300,
      }),
      prisma.lead.groupBy({
        by: ['estado'],
        _count: true,
      }),
    ])

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const totalHoy = leads.filter(l => new Date(l.createdAt) >= hoy).length

    const porEstado = {}
    let total = 0
    for (const s of stats) {
      porEstado[s.estado] = s._count
      total += s._count
    }

    return NextResponse.json({
      leads,
      stats: {
        total,
        totalHoy,
        porEstado,
        tasaConversion: total > 0 ? Math.round(((porEstado.registrado || 0) / total) * 100) : 0,
      },
    })
  } catch (error) {
    console.error('[GET /api/admin/leads]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
