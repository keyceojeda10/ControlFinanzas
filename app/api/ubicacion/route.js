import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { sanitizarCoords }  from '@/lib/geo'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'cobrador') return Response.json({ error: 'Solo cobradores' }, { status: 403 })

  let body
  try { body = await req.json() } catch { return Response.json({ error: 'Body invalido' }, { status: 400 }) }

  const { lat, lng } = body
  const coords = sanitizarCoords(lat, lng)
  if (!coords.latitud || !coords.longitud) {
    return Response.json({ error: 'Coordenadas invalidas' }, { status: 400 })
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      latitud: coords.latitud,
      longitud: coords.longitud,
      ubicacionUpdatedAt: new Date(),
    },
  })

  return Response.json({ ok: true })
}
