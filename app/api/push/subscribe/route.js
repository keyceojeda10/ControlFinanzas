// app/api/push/subscribe/route.js — Guardar suscripción push del browser
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { endpoint, keys } = await request.json()
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return Response.json({ error: 'Suscripción inválida' }, { status: 400 })
  }

  // Upsert: si ya existe este endpoint para el usuario, no duplicar
  const existing = await prisma.pushSubscription.findFirst({
    where: { userId: session.user.id, endpoint },
  })

  if (!existing) {
    await prisma.pushSubscription.create({
      data: {
        userId: session.user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
      },
    })
  }

  return Response.json({ ok: true })
}
