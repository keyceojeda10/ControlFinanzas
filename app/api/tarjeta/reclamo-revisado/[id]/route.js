// app/api/tarjeta/reclamo-revisado/[id]/route.js — el dueño ya miró el reclamo. Solo el dueño.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(_req, { params }) {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user?.organizationId
  if (!organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'No autorizado' }, { status: 403 })

  const { id } = await params
  const r = await prisma.reclamoPago.updateMany({
    where: { id, organizationId, revisadoEn: null },
    data: { revisadoEn: new Date(), revisadoPorId: session.user.id },
  })
  return Response.json({ ok: true, revisados: r.count })
}
