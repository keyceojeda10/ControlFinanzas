// app/api/rutas/[id]/orden-anterior/route.js — «Volver al orden anterior».
//
// Deshace el último «Optimizar» (lo haya tocado el dueño o lo haya aprobado a
// pedido del cobrador). Quien llegó a la ruta después va al final; quien salió,
// se salta. Solo el dueño: el orden es de los dos. Ver lib/rutas/orden-de-ruta.js.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad }     from '@/lib/activity-log'
import { volverAlOrdenAnterior } from '@/lib/rutas/orden-de-ruta'

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el dueño puede volver al orden anterior' }, { status: 403 })

  const { id } = await params
  const { organizationId } = session.user
  const ruta = await prisma.ruta.findFirst({ where: { id, organizationId }, select: { nombre: true } })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const r = await volverAlOrdenAnterior(prisma, { organizationId, rutaId: id })
  if (!r.ok) return Response.json({ error: r.error }, { status: 404 })

  logActividad({
    session, accion: 'volver_orden_ruta', entidadTipo: 'ruta', entidadId: id,
    detalle: `Volvió la ruta ${ruta.nombre} al orden que tenía antes de optimizarla`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  return Response.json(r)
}
