// app/api/caja/reabrir/rechazar/route.js
// El owner rechaza la solicitud de reapertura de caja de un cobrador.
// La caja sigue cerrada.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { enviarPush } from '@/lib/push'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId } = session.user
  const { cierreId } = await request.json()
  if (!cierreId) return Response.json({ error: 'Falta cierreId' }, { status: 400 })

  const cierre = await prisma.cierreCaja.findFirst({
    where: { id: cierreId, organizationId },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })
  if (!cierre) return Response.json({ error: 'Cierre no encontrado' }, { status: 404 })
  if (!cierre.solicitudReaperturaEn) return Response.json({ error: 'No hay una solicitud pendiente para este cierre' }, { status: 400 })

  const cierreActualizado = await prisma.cierreCaja.update({
    where: { id: cierre.id },
    data: { solicitudReaperturaEn: null, solicitudReaperturaPorId: null },
  })

  logActividad({
    session,
    accion: 'rechazo_reapertura_cierre_caja',
    entidadTipo: 'caja',
    entidadId: cierre.id,
    detalle: `Reapertura de caja rechazada para ${cierre.cobrador?.nombre ?? ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  enviarPush(cierre.cobradorId, {
    title: 'Reapertura de caja rechazada',
    body: `${session.user.nombre} no aprobó la reapertura de tu caja de hoy.`,
    url: '/caja',
  }).catch(() => {})

  return Response.json(cierreActualizado, { status: 200 })
}
