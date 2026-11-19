// app/api/rutas/[id]/reordenar/route.js - Reordenar clientes dentro de una ruta

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'

export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { organizationId, rol, rutaIds = [] } = session.user

  // Owner o cobrador asignado a esta ruta
  if (rol === 'cobrador' && !rutaIds.includes(id)) {
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
  // ⚠ TIENEN QUE SER TEXTO. Los ids son varchar y en MariaDB comparar texto con
  // NÚMERO convierte cada texto a número: los cuid empiezan por letra, así que
  // todos valen 0. Un `in: [0, 1, 2]` casa con filas que no son, y aquí abajo
  // se ACTUALIZAN. El contador de más abajo no protege: devuelve de más, no de
  // menos. Esta pantalla ya mandó índices una vez por un id que faltaba.
  if (!clienteIds.every((c) => typeof c === 'string' && c.trim())) {
    return Response.json({ error: 'clienteIds debe traer identificadores de texto' }, { status: 400 })
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

  /* QUIÉN MOVIÓ EL ORDEN (19 nov 2026). Una ruta revuelta no dejaba rastro y
     hubo que sacarlo de los registros del servidor. Una fila por persona y ruta
     cada 30 minutos: arrastrar diez clientes seguidos no llena el historial. */
  const hace30 = new Date(Date.now() - 30 * 60000)
  const yaAnotado = await prisma.actividadLog.findFirst({
    where: { organizationId, userId: session.user.id, accion: 'reordenar_ruta', entidadId: id, createdAt: { gte: hace30 } },
    select: { id: true },
  }).catch(() => null)
  if (!yaAnotado) {
    logActividad({
      session, accion: 'reordenar_ruta', entidadTipo: 'ruta', entidadId: id,
      detalle: `Movió clientes de puesto en la ruta ${ruta.nombre}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
  }

  return Response.json({ reordenados: clienteIds.length })
}
