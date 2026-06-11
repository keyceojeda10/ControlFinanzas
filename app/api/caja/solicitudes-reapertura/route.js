// app/api/caja/solicitudes-reapertura/route.js
// Lista las solicitudes de reapertura de caja pendientes de aprobacion (owner).

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user

  const solicitudes = await prisma.cierreCaja.findMany({
    where: { organizationId, solicitudReaperturaEn: { not: null }, reabiertoEn: null },
    include: { cobrador: { select: { id: true, nombre: true } } },
    orderBy: { solicitudReaperturaEn: 'asc' },
  })

  return Response.json({ solicitudes })
}
