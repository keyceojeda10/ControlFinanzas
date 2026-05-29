// app/api/caja/historial-owner/route.js
// Lista los cierres del owner (cuando el mismo cobra) ordenados desc.
// Util para mostrar historial en la pagina de caja del owner sin cobradores.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede ver su historial' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '30', 10), 1), 100)

  const cierres = await prisma.cierreCaja.findMany({
    where: { organizationId, cobradorId: userId },
    orderBy: { fecha: 'desc' },
    take: limit,
    select: {
      id: true,
      fecha: true,
      totalRecogido: true,
      totalGastos: true,
      totalDesembolsado: true,
      saldoRealCaja: true,
      diferencia: true,
      createdAt: true,
    },
  })

  return Response.json({ cierres })
}
