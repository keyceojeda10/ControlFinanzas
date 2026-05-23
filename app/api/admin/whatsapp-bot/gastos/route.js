// app/api/admin/whatsapp-bot/gastos/route.js — Desglose de gastos API
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const dias = parseInt(searchParams.get('dias') || '30')
  const desde = new Date(Date.now() - dias * 24 * 3600000)

  const [porProveedor, porDia, total] = await Promise.all([
    prisma.botGastoApi.groupBy({
      by: ['proveedor'],
      where: { createdAt: { gte: desde } },
      _sum: { costoUsd: true, tokensIn: true, tokensOut: true },
      _count: true,
    }),
    prisma.$queryRaw`
      SELECT DATE(createdAt) as fecha, SUM(costoUsd) as costoUsd, COUNT(*) as llamadas
      FROM BotGastoApi
      WHERE createdAt >= ${desde}
      GROUP BY DATE(createdAt)
      ORDER BY fecha DESC
      LIMIT 30
    `,
    prisma.botGastoApi.aggregate({
      _sum: { costoUsd: true },
    }),
  ])

  return NextResponse.json({
    porProveedor: porProveedor.map(p => ({
      proveedor: p.proveedor,
      costoUsd: +(p._sum.costoUsd || 0).toFixed(4),
      tokensIn: p._sum.tokensIn || 0,
      tokensOut: p._sum.tokensOut || 0,
      llamadas: p._count,
    })),
    porDia: porDia.map(d => ({
      fecha: d.fecha,
      costoUsd: +(Number(d.costoUsd) || 0).toFixed(4),
      llamadas: Number(d.llamadas),
    })),
    totalUsd: +(total._sum.costoUsd || 0).toFixed(4),
  })
}
