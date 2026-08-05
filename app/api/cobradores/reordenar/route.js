// app/api/cobradores/reordenar/route.js - Reordenar los cobradores (orden manual del owner)

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol } = session.user
  // Solo el owner organiza el orden de los cobradores.
  if (rol !== 'owner') {
    return Response.json({ error: 'No tienes permiso para reordenar cobradores' }, { status: 403 })
  }

  const { cobradorIds } = await request.json()
  if (!Array.isArray(cobradorIds) || !cobradorIds.length) {
    return Response.json({ error: 'cobradorIds debe ser un array no vacío' }, { status: 400 })
  }
  // Igual que en el reordenar de clientes: un número casaría con cobradores que
  // no son, y aquí abajo se actualizan. Ver el comentario largo de aquel.
  if (!cobradorIds.every((c) => typeof c === 'string' && c.trim())) {
    return Response.json({ error: 'cobradorIds debe traer identificadores de texto' }, { status: 400 })
  }

  // Verificar que todos los cobradores pertenecen a la organización.
  const cobradores = await prisma.user.findMany({
    where: { id: { in: cobradorIds }, organizationId, rol: 'cobrador' },
    select: { id: true },
  })
  if (cobradores.length !== cobradorIds.length) {
    return Response.json({ error: 'Uno o más cobradores no pertenecen a tu organización' }, { status: 400 })
  }

  // Actualizar orden en una transacción.
  await prisma.$transaction(
    cobradorIds.map((cid, index) =>
      prisma.user.update({
        where: { id: cid },
        data: { orden: index },
      })
    )
  )

  return Response.json({ reordenados: cobradorIds.length })
}
