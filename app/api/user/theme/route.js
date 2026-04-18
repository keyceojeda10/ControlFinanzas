// app/api/user/theme/route.js
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const ALLOWED = new Set(['light', 'dark', 'system'])

export async function PATCH(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const body = await request.json().catch(() => ({}))
  const { theme } = body || {}
  if (!ALLOWED.has(theme)) {
    return Response.json({ error: 'Tema invalido' }, { status: 400 })
  }
  try {
    await prisma.user.update({
      where: { id: session.user.id },
      data:  { theme },
    })
  } catch {
    // si la columna aun no existe en DB (migracion pendiente), respondemos OK
    // para no romper el UX. El tema persiste igual en localStorage.
    return Response.json({ ok: true, persisted: false })
  }
  return Response.json({ ok: true, persisted: true })
}
