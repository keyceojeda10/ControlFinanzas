// app/api/video-bienvenida/route.js — ¿Esta persona ya abrió la clase?
//
// «Sale una sola vez por persona», y tiene que valer en cualquier teléfono:
// por eso no va en localStorage. No hace falta columna nueva: la apertura ya
// queda apuntada en `Evento` (es la misma medición), y se busca por persona.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { EVENTOS_VIDEO } from '@/lib/video-bienvenida'

export async function GET() {
  const session = await getServerSession(authOptions)
  const u = session?.user
  if (!u?.id || !u.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const vez = await prisma.evento.findFirst({
    where: { organizationId: u.organizationId, userId: u.id, evento: EVENTOS_VIDEO.abierto },
    select: { id: true },
  })
  return Response.json({ visto: Boolean(vez) })
}
