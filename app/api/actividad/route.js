// app/api/actividad/route.js — Listar actividad de la organización (paginado, filtros)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  // Solo owner puede ver la actividad
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const cursor = searchParams.get('cursor')
  const tipo = searchParams.get('tipo')       // filtro por accion
  const userId = searchParams.get('userId')   // filtro por usuario
  const limit = Math.min(Number(searchParams.get('limit')) || 20, 50)

  const where = {
    organizationId: session.user.organizationId,
    ...(tipo && { accion: tipo }),
    ...(userId && { userId }),
  }

  const actividad = await prisma.actividadLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit + 1,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
    include: {
      user: { select: { id: true, nombre: true, rol: true } },
    },
  })

  const hasMore = actividad.length > limit
  const items = hasMore ? actividad.slice(0, limit) : actividad
  const nextCursor = hasMore ? items[items.length - 1].id : null

  return Response.json({ items, nextCursor })
}
