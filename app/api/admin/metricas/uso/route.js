// app/api/admin/metricas/uso/route.js — Datos de uso agregados para admin
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (session?.user?.rol !== 'superadmin') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const now = new Date()
  const day1 = new Date(now); day1.setHours(0, 0, 0, 0)
  const day7 = new Date(day1); day7.setDate(day7.getDate() - 7)
  const day30 = new Date(day1); day30.setDate(day30.getDate() - 30)

  // DAU, WAU, MAU (unique users)
  const [dau, wau, mau] = await Promise.all([
    prisma.evento.findMany({
      where: { createdAt: { gte: day1 }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.evento.findMany({
      where: { createdAt: { gte: day7 }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
    prisma.evento.findMany({
      where: { createdAt: { gte: day30 }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    }),
  ])

  // Top features (most tracked events in last 30 days, excluding page_view)
  const topFeatures = await prisma.evento.groupBy({
    by: ['evento'],
    where: { createdAt: { gte: day30 }, evento: { not: 'page_view' } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Top pages (last 30 days)
  const topPages = await prisma.evento.groupBy({
    by: ['pagina'],
    where: { createdAt: { gte: day30 }, evento: 'page_view', pagina: { not: null } },
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
    take: 10,
  })

  // Daily active users trend (last 14 days)
  const dailyTrend = []
  for (let i = 13; i >= 0; i--) {
    const start = new Date(day1)
    start.setDate(start.getDate() - i)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    const count = await prisma.evento.findMany({
      where: { createdAt: { gte: start, lt: end }, userId: { not: null } },
      distinct: ['userId'],
      select: { userId: true },
    })
    dailyTrend.push({
      fecha: start.toISOString().slice(0, 10),
      usuarios: count.length,
    })
  }

  return Response.json({
    dau: dau.length,
    wau: wau.length,
    mau: mau.length,
    topFeatures: topFeatures.map((f) => ({ evento: f.evento, count: f._count.id })),
    topPages: topPages.map((p) => ({ pagina: p.pagina, count: p._count.id })),
    dailyTrend,
  })
}
