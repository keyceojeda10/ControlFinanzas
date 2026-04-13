import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const COLORES_GRUPO = [
  '#3b82f6', '#22c55e', '#f59e0b', '#ef4444',
  '#a855f7', '#06b6d4', '#ec4899', '#84cc16',
]

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaId } = session.user

  if (rol === 'cobrador' && id !== rutaId) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const grupos = await prisma.grupoCobro.findMany({
    where: { rutaId: id, organizationId },
    orderBy: { orden: 'asc' },
    include: { _count: { select: { clientes: true } } },
  })

  return Response.json(grupos)
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede crear grupos' }, { status: 403 })
  }

  const { id } = await params
  const { organizationId } = session.user

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    select: { id: true },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { nombre, color } = await request.json()

  if (!nombre?.trim()) {
    return Response.json({ error: 'El nombre es requerido' }, { status: 400 })
  }

  const maxOrden = await prisma.grupoCobro.aggregate({
    where: { rutaId: id },
    _max: { orden: true },
  })

  const gruposCount = await prisma.grupoCobro.count({ where: { rutaId: id } })
  const colorAuto = color || COLORES_GRUPO[gruposCount % COLORES_GRUPO.length]

  const grupo = await prisma.grupoCobro.create({
    data: {
      organizationId,
      rutaId: id,
      nombre: nombre.trim(),
      color: colorAuto,
      orden: (maxOrden._max.orden ?? -1) + 1,
    },
    include: { _count: { select: { clientes: true } } },
  })

  return Response.json(grupo, { status: 201 })
}
