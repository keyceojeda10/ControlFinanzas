import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const { id } = await params

  const user = await prisma.user.findFirst({
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
  })

  if (!user) return Response.json({ error: 'No encontrado' }, { status: 404 })

  return Response.json(user)
}
