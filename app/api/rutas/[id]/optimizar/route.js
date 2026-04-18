// app/api/rutas/[id]/optimizar/route.js — Optimizar orden de clientes en una ruta

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { optimizeRoute }    from '@/lib/routeOptimizer'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { id: userId, organizationId, rol } = session.user

  if (rol === 'cobrador') {
    const acceso = await prisma.ruta.findFirst({ where: { id, organizationId, cobradorId: userId }, select: { id: true } })
    if (!acceso) return Response.json({ error: 'No tienes acceso a esta ruta' }, { status: 403 })
  }

  // Obtener ruta con clientes y sus coordenadas
  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    include: {
      clientes: {
        select: { id: true, nombre: true, latitud: true, longitud: true, ordenRuta: true },
        orderBy: { ordenRuta: 'asc' },
      },
    },
  })

  if (!ruta) {
    return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })
  }

  if (!ruta.clientes.length) {
    return Response.json({ error: 'La ruta no tiene clientes' }, { status: 400 })
  }

  const conCoords = ruta.clientes.filter((c) => c.latitud != null && c.longitud != null)
  if (conCoords.length < 2) {
    return Response.json({
      error: `Se necesitan al menos 2 clientes con ubicación para optimizar. Solo ${conCoords.length} tienen ubicación.`,
    }, { status: 400 })
  }

  // Optimizar
  const { optimized, sinCoords, distanciaAntes, distanciaDespues } = optimizeRoute(ruta.clientes)

  // Guardar nuevo orden
  await prisma.$transaction(
    optimized.map((c, index) =>
      prisma.cliente.update({
        where: { id: c.id },
        data: { ordenRuta: index },
      })
    )
  )

  return Response.json({
    optimizado: true,
    clientesReordenados: optimized.length,
    clientesSinUbicacion: sinCoords,
    distanciaAntes,
    distanciaDespues,
    ahorro: distanciaAntes > 0
      ? Math.round(((distanciaAntes - distanciaDespues) / distanciaAntes) * 100)
      : 0,
    nuevoOrden: optimized.map((c) => ({ id: c.id, nombre: c.nombre })),
  })
}
