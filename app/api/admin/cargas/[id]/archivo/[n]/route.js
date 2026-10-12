// El archivo original de una carga, para verlo al lado de la fila (superadmin).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { archivosDe, leerArchivoGuardado } from '@/lib/carga-asesor/solicitud'
import { disposicionAdjunto } from '@/lib/papel/documento'

export const runtime = 'nodejs'

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions)
  if (session?.user?.rol !== 'superadmin') return new Response('No autorizado', { status: 403 })
  const { id, n } = await params
  const sol = await prisma.solicitudCarga.findUnique({ where: { id }, select: { archivos: true } })
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
