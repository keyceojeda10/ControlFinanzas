// app/api/push/unsubscribe/route.js — Eliminar suscripción push
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { endpoint } = await request.json()
  if (!endpoint) {
    return Response.json({ error: 'Endpoint requerido' }, { status: 400 })
  }

  await prisma.pushSubscription.deleteMany({
    where: { userId: session.user.id, endpoint },
  })

  return Response.json({ ok: true })
}
