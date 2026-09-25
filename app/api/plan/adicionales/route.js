// app/api/plan/adicionales/route.js — los cobradores y rutas adicionales del
// negocio: qué tiene (GET) y cambiarlos sin pagar aparte (PATCH).
//
// Agregar con el plan pagado NO pasa por aquí: se paga (los días que faltan)
// en /api/pagos/wompi/adicionales y lo suma el webhook. Las reglas, en
// lib/adicionales.js.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { estadoAdicionales, cambiarAdicionales, paraPantalla } from '@/lib/adicionales'
import { logActividad }     from '@/lib/activity-log'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const e = await estadoAdicionales(session.user.organizationId)
  if (!e) return Response.json({ error: 'Organización no encontrada' }, { status: 404 })
  return Response.json({ ...paraPantalla(e), esDueno: session.user.rol === 'owner' })
}

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el dueño de la cuenta puede cambiar el plan' }, { status: 403 })
  }

  /* Un cambio (`delta` +1 / −1), no una cifra: ver `cambiarAdicionales`. */
  const body = await request.json().catch(() => ({}))
  const r = await cambiarAdicionales({
    organizationId: session.user.organizationId,
    tipo: body?.tipo,
    delta: Number(body?.delta),
  })
  if (r.error) return Response.json({ error: r.error, requierePago: r.requierePago ?? false }, { status: r.status })

  logActividad({
    session,
    accion: 'adicionales_cambiados',
    entidadTipo: 'organizacion',
    entidadId: session.user.organizationId,
    detalle: `Adicionales del plan: ${body.tipo} ${r.antes} → ${r.despues}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  return Response.json({ ...paraPantalla(r.estado), esDueno: true })
}
