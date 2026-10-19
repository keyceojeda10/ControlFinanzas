import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const { id } = await params

  // El día del país, no el del servidor (UTC): con `setHours(0)` el rastro de
  // «hoy» empezaba a las 7 p. m. de ayer en Bogotá (DETALLES-RUTAS #57).
  const hoy = getLocalDayRange(getLocalDateStr(session.user.country), session.user.country).inicio

  const [user, trail] = await Promise.all([
    prisma.user.findFirst({
      where: {
        id,
        organizationId: session.user.organizationId,
        rol: 'cobrador',
      },
      select: {
        latitud: true,
        longitud: true,
        ubicacionUpdatedAt: true,
      },
    }),
    prisma.ubicacionLog.findMany({
      where: { userId: id, createdAt: { gte: hoy } },
      orderBy: { createdAt: 'asc' },
      select: { latitud: true, longitud: true, createdAt: true },
    }),
  ])

  if (!user) return Response.json({ error: 'No encontrado' }, { status: 404 })

  return Response.json({ ...user, trail })
}
