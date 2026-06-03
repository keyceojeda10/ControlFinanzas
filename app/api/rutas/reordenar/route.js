// app/api/rutas/reordenar/route.js - Reordenar las rutas (orden manual del owner)

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  // Solo el owner organiza el orden de las rutas
  if (rol !== 'owner') {
    return Response.json({ error: 'No tienes permiso para reordenar rutas' }, { status: 403 })
  }

  const { rutaIds } = await request.json()
  if (!Array.isArray(rutaIds) || !rutaIds.length) {
    return Response.json({ error: 'rutaIds debe ser un array no vacío' }, { status: 400 })
  }

  // Verificar que todas las rutas pertenecen a la organización
  const rutas = await prisma.ruta.findMany({
    where: { id: { in: rutaIds }, organizationId },
    select: { id: true },
  })
  if (rutas.length !== rutaIds.length) {
    return Response.json({ error: 'Una o más rutas no pertenecen a tu organización' }, { status: 400 })
  }

  // Actualizar orden en una transacción
  await prisma.$transaction(
    rutaIds.map((rid, index) =>
      prisma.ruta.update({
        where: { id: rid },
        data: { orden: index },
      })
    )
  )

  return Response.json({ reordenados: rutaIds.length })
}
