// app/api/notificaciones/preferencias/route.js — qué avisos quiere cada quien.
// La forma y los valores por defecto viven en `lib/avisos-preferencias.js`.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { normalizarPrefs, limpiarPrefs } from '@/lib/avisos-preferencias'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const u = await prisma.user.findUnique({ where: { id: session.user.id }, select: { prefsAvisos: true } })
  return Response.json({ prefs: normalizarPrefs(u?.prefsAvisos), rol: session.user.rol })
}

export async function PUT(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') return Response.json({ error: 'Parámetros inválidos' }, { status: 400 })
  const prefs = limpiarPrefs(body)
  await prisma.user.update({ where: { id: session.user.id }, data: { prefsAvisos: prefs } })
  return Response.json({ prefs: normalizarPrefs(prefs) })
}
