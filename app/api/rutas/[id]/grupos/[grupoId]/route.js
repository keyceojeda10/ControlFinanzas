import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function PATCH(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede editar grupos' }, { status: 403 })
  }

  const { id, grupoId } = await params
  const { organizationId } = session.user

  const grupo = await prisma.grupoCobro.findFirst({
    where: { id: grupoId, rutaId: id, organizationId },
  })
  if (!grupo) return Response.json({ error: 'Grupo no encontrado' }, { status: 404 })

  const { nombre, color, orden } = await request.json()

  const actualizado = await prisma.grupoCobro.update({
    where: { id: grupoId },
    data: {
      ...(nombre !== undefined && { nombre: nombre.trim() }),
      ...(color  !== undefined && { color }),
      ...(orden  !== undefined && { orden }),
    },
    include: { _count: { select: { clientes: true } } },
  })

  return Response.json(actualizado)
}

export async function DELETE(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede eliminar grupos' }, { status: 403 })
  }

  const { id, grupoId } = await params
  const { organizationId } = session.user

  const grupo = await prisma.grupoCobro.findFirst({
    where: { id: grupoId, rutaId: id, organizationId },
  })
  if (!grupo) return Response.json({ error: 'Grupo no encontrado' }, { status: 404 })

  await prisma.grupoCobro.delete({ where: { id: grupoId } })

  return Response.json({ eliminado: true })
}
