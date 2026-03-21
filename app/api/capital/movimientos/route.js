// app/api/capital/movimientos/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver los movimientos' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { searchParams } = new URL(request.url)
  const page = Math.max(1, Number(searchParams.get('page') || 1))
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)))
  const tipo = searchParams.get('tipo')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const where = {
    organizationId,
    ...(tipo && { tipo }),
    ...(desde || hasta ? {
      createdAt: {
        ...(desde && { gte: new Date(desde) }),
        ...(hasta && { lte: new Date(hasta + 'T23:59:59.999Z') }),
      },
    } : {}),
  }

  const [movimientos, total] = await Promise.all([
    prisma.movimientoCapital.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.movimientoCapital.count({ where }),
  ])

  return Response.json({
    movimientos,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  })
}
