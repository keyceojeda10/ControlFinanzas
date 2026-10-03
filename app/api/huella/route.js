// app/api/huella/route.js — los teléfonos con los que esta cuenta entra con huella.
// GET                 → [{ id, credencialId, dispositivo, createdAt, usadaEn }]
// DELETE { id }       → quita ese teléfono
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const llaves = await prisma.llaveAcceso.findMany({
    where: { userId: session.user.id },
    // `credencialId` no es secreto (lo manda el teléfono en cada firma): con él la
    // pantalla sabe cuál de la lista es ESTE teléfono.
    select: { id: true, credencialId: true, dispositivo: true, createdAt: true, usadaEn: true },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json(llaves)
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await request.json().catch(() => ({}))
  // Solo las suyas: `userId` va en el filtro, no se confía en el id solo.
  const r = await prisma.llaveAcceso.deleteMany({ where: { id: String(id ?? ''), userId: session.user.id } })
  return Response.json({ ok: r.count === 1 })
}
