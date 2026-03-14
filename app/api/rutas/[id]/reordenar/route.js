// app/api/rutas/[id]/reordenar/route.js - Reordenar clientes dentro de una ruta

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaId } = session.user

  // Owner o cobrador asignado a esta ruta
  if (rol === 'cobrador' && rutaId !== id) {
    return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const { clienteIds } = await request.json()
  if (!Array.isArray(clienteIds) || !clienteIds.length) {
    return Response.json({ error: 'clienteIds debe ser un array no vacío' }, { status: 400 })
  }

  // Verificar que todos los clientes pertenecen a esta ruta y organización
  const clientes = await prisma.cliente.findMany({
    where: { id: { in: clienteIds }, organizationId, rutaId: id },
    select: { id: true },
  })
  if (clientes.length !== clienteIds.length) {
    return Response.json({ error: 'Uno o más clientes no pertenecen a esta ruta' }, { status: 400 })
  }

  // Actualizar orden en una transacción
  await prisma.$transaction(
    clienteIds.map((cid, index) =>
      prisma.cliente.update({
        where: { id: cid },
        data: { ordenRuta: index },
      })
    )
  )

  return Response.json({ reordenados: clienteIds.length })
}
