// app/api/carga-asesor/ayuda/route.js — «Necesito ayuda».
//
// POST { solicitudId, nota? } → `pedirAyuda`: la solicitud pasa de `en_revision` a
// `ayuda` y SOLO entonces le llega a Carlos. Con un segundo toque no se avisa dos
// veces (`yaEstaba`).

import { prisma } from '@/lib/prisma'
import { sesionDueno } from '@/lib/carga-asesor/sesion-dueno'
import { pedirAyuda } from '@/lib/carga-asesor/solicitud'
import { esId } from '@/lib/ids'

export const runtime = 'nodejs'

export async function POST(request) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const organizationId = session.user.organizationId

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body) || !esId(body.solicitudId)) {
    return Response.json({ error: 'Falta la solicitud' }, { status: 400 })
  }

  // La solicitud tiene que ser de SU negocio (nunca por id a secas).
  const sol = await prisma.solicitudCarga.findFirst({ where: { id: body.solicitudId, organizationId }, select: { id: true } })
  if (!sol) return Response.json({ error: 'No existe' }, { status: 404 })

  const r = await pedirAyuda({ id: sol.id, organizationId, nota: typeof body.nota === 'string' ? body.nota : '' })
  if (r.error) return Response.json({ error: r.error }, { status: r.status ?? 400 })
  return Response.json(r)
}
