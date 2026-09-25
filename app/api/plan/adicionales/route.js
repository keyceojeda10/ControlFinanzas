// app/api/plan/adicionales/route.js — los cobradores y rutas adicionales del
// negocio: qué tiene (GET) y cambiarlos sin pagar aparte (PATCH).
//
// Agregar con el plan pagado NO pasa por aquí: se paga (los días que faltan)
// en /api/pagos/wompi/adicionales y lo suma el webhook. Las reglas, en
// lib/adicionales.js.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { estadoAdicionales, cambiarAdicionales, paraPantalla, leerCantidad } from '@/lib/adicionales'
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

  const body = await request.json().catch(() => ({}))
  const cobradores = leerCantidad(body?.cobradores)
  const rutas = leerCantidad(body?.rutas)
  if ((body?.cobradores != null && cobradores == null) || (body?.rutas != null && rutas == null)) {
    return Response.json({ error: 'Cantidad no válida' }, { status: 400 })
  }
  if (cobradores == null && rutas == null) return Response.json({ error: 'Nada que cambiar' }, { status: 400 })

  const r = await cambiarAdicionales({ organizationId: session.user.organizationId, cobradores, rutas })
  if (r.error) return Response.json({ error: r.error, requierePago: r.requierePago ?? false }, { status: r.status })

  const cambios = [
    r.antes.cobradores !== r.despues.cobradores && `cobradores ${r.antes.cobradores} → ${r.despues.cobradores}`,
    r.antes.rutas !== r.despues.rutas && `rutas ${r.antes.rutas} → ${r.despues.rutas}`,
  ].filter(Boolean)
  if (cambios.length > 0) {
    logActividad({
      session,
      accion: 'adicionales_cambiados',
      entidadTipo: 'organizacion',
      entidadId: session.user.organizationId,
      detalle: `Adicionales del plan: ${cambios.join(', ')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
  }
  return Response.json({ ...paraPantalla(r.estado), esDueno: true })
}
