// app/api/rutas/[id]/unir/route.js — unir esta ruta con otra.
//
// GET  ?destino=<id>                          → lo que va a pasar (solo lee)
// POST { destinoId, cobradorId? }             → la une; `cobradorId` null = sin cobrador,
//                                               ausente = el de la ruta destino
//
// La cuenta y las reglas viven en lib/rutas/fusionar.js. Solo el dueño.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { vistaUnion, unirRutas } from '@/lib/rutas/fusionar'
import { logActividad }     from '@/lib/activity-log'
import { notificar }        from '@/lib/notificar'

async function sesionDueno() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return { error: Response.json({ error: 'No autorizado' }, { status: 401 }) }
  if (session.user.rol !== 'owner') {
    return { error: Response.json({ error: 'Solo el dueño puede unir rutas' }, { status: 403 }) }
  }
  return { session }
}

export async function GET(request, { params }) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const { id } = await params
  const destinoId = new URL(request.url).searchParams.get('destino')
  const v = await vistaUnion(prisma, { organizationId: session.user.organizationId, origenId: id, destinoId })
  if (v.error) return Response.json({ error: v.error }, { status: v.status })
  return Response.json(v)
}

export async function POST(request, { params }) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const { id } = await params
  const body = await request.json().catch(() => ({}))
  const destinoId = typeof body?.destinoId === 'string' ? body.destinoId : null
  /* Tres casos distintos: un id, null (sin cobrador) o ausente (el de la ruta destino). */
  const cobradorId = body && 'cobradorId' in body
    ? (typeof body.cobradorId === 'string' && body.cobradorId ? body.cobradorId : null)
    : undefined

  const r = await unirRutas(prisma, {
    organizationId: session.user.organizationId,
    origenId: id,
    destinoId,
    cobradorId,
    usuarioId: session.user.id,
  })
  if (r.error) return Response.json({ error: r.error }, { status: r.status })

  const pesos = (n) => '$' + Math.abs(n).toLocaleString('es-CO')
  logActividad({
    session,
    accion: 'unir_rutas',
    entidadTipo: 'ruta',
    entidadId: r.destino.id,
    detalle: `Unió ${r.origen.nombre} con ${r.destino.nombre}: ${r.clientes} clientes${r.capital ? ` y ${r.capital < 0 ? '−' : ''}${pesos(r.capital)} de capital` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  /* Al que la cobra desde hoy: se entera por el aviso, no al ver la lista crecer. */
  if (r.cobradorId && r.clientes > 0) {
    notificar({
      organizationId: session.user.organizationId, para: r.cobradorId, tipo: 'prestamo_trasladado', excepto: session.user.id,
      titulo: `${r.clientes} ${r.clientes === 1 ? 'cliente pasa' : 'clientes pasan'} a tu ruta`,
      mensaje: `${r.origen.nombre} se unió con ${r.destino.nombre}. Desde hoy los cobras tú.`,
      href: `/rutas/${r.destino.id}`, datos: { rutaId: r.destino.id },
    })
  }

  return Response.json(r)
}
