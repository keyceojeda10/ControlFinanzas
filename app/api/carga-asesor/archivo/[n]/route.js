// app/api/carga-asesor/archivo/[n]/route.js — el archivo original de SU carga.
//
// El dueño lo abre al lado de la fila que está revisando (la foto o la hoja de
// donde salió). Es la misma respuesta que la ruta del superadmin
// (`app/api/admin/cargas/[id]/archivo/[n]`), pero solo de una solicitud de SU
// negocio. `n` es el número del archivo dentro de la solicitud; sin
// `?solicitudId=` es la última de los últimos 60 días (la misma que enseña el GET
// de `/api/carga-asesor`).

import { prisma } from '@/lib/prisma'
import { sesionDueno } from '@/lib/carga-asesor/sesion-dueno'
import { archivosDe, leerArchivoGuardado } from '@/lib/carga-asesor/solicitud'
import { disposicionAdjunto } from '@/lib/papel/documento'
import { esId } from '@/lib/ids'

export const runtime = 'nodejs'

export async function GET(req, { params }) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const organizationId = session.user.organizationId
  const { n } = await params
  const pedida = new URL(req.url).searchParams.get('solicitudId')

  // Siempre dentro de SU negocio: un id de otro negocio es una solicitud que no existe.
  const sol = await prisma.solicitudCarga.findFirst({
    where: pedida
      ? { id: pedida, organizationId }
      : { organizationId, createdAt: { gte: new Date(Date.now() - 60 * 86400000) } },
    orderBy: { createdAt: 'desc' },
    select: { archivos: true },
  })
  if (!sol || !esId(n)) return new Response('No existe', { status: 404 })
  const a = archivosDe(sol).find((x) => String(x.n) === String(n))
  if (!a) return new Response('No existe', { status: 404 })
  const buffer = await leerArchivoGuardado(a.ruta)
  if (!buffer) return new Response('No está en el almacén', { status: 404 })
  const enLinea = a.tipo === 'imagen' || a.tipo === 'pdf'
  return new Response(buffer, {
    headers: {
      'Content-Type': a.mime || 'application/octet-stream',
      'Content-Disposition': enLinea ? 'inline' : disposicionAdjunto(a.nombre),
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
