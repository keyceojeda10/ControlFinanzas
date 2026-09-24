// app/api/carga-masiva/importar/route.js
// La sesión y el Historial viven aquí; la importación, en lib/importar-cartera.js
// (la misma que usa el soporte para cargarle la cartera a un cliente).

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { importarCartera }  from '@/lib/importar-cartera'
import { logActividad }     from '@/lib/activity-log'
import { trackEvent }       from '@/lib/analytics'
import { dispararTrasCrear } from '@/lib/capi-activacion'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })
    }

    const { organizationId, plan } = session.user
    const { filas, rutaId, crearRuta } = await request.json()

    if (!Array.isArray(filas) || filas.length === 0) {
      return Response.json({ error: 'No hay datos para importar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return Response.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

    const r = await importarCartera({ organizationId, plan, usuarioId: session.user.id, filas, rutaId, crearRuta })
    if (r.error) return Response.json({ error: r.error }, { status: r.status })
    const { clientesCreados, prestamosCreados, rutaAsignada } = r.resultado

    logActividad({
      session,
      accion: 'carga_masiva',
      entidadTipo: 'cliente',
      detalle: `Carga masiva: ${clientesCreados} clientes, ${prestamosCreados} préstamos${rutaAsignada ? ', ruta asignada' : ''}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
    trackEvent({
      organizationId,
      userId: session.user.id,
      evento: 'carga_masiva',
      metadata: { clientesCreados, prestamosCreados, filas: filas.length },
    })
    // Una carga masiva puede cruzar los dos umbrales de golpe (6 y 21): el
    // helper evalua ambos por separado y emite un evento por cada uno cruzado.
    dispararTrasCrear({ organizationId, creados: clientesCreados })

    return Response.json({ resultado: r.resultado })
  } catch (err) {
    console.error('[POST /api/carga-masiva/importar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
