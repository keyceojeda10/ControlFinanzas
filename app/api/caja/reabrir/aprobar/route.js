// app/api/caja/reabrir/aprobar/route.js
// El owner aprueba la solicitud de reapertura de caja de un cobrador.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { esId }             from '@/lib/ids'
import { logActividad } from '@/lib/activity-log'
import { notificar } from '@/lib/notificar'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { organizationId, id: userId } = session.user
  const { cierreId } = await request.json()
  // `esId` y no `!cierreId`: un número casaría con cualquier cierre. Ver lib/ids.js.
  if (!esId(cierreId)) return Response.json({ error: 'Falta cierreId' }, { status: 400 })

  const cierre = await prisma.cierreCaja.findFirst({
    where: { id: cierreId, organizationId },
    include: { cobrador: { select: { id: true, nombre: true } } },
  })
  if (!cierre) return Response.json({ error: 'Cierre no encontrado' }, { status: 404 })
  if (!cierre.solicitudReaperturaEn) return Response.json({ error: 'No hay una solicitud pendiente para este cierre' }, { status: 400 })

  const cierreActualizado = await prisma.cierreCaja.update({
    where: { id: cierre.id },
    data: {
      reabiertoEn: new Date(),
      reabiertoPorId: userId,
      solicitudReaperturaEn: null,
      solicitudReaperturaPorId: null,
    },
  })

  logActividad({
    session,
    accion: 'aprobacion_reapertura_cierre_caja',
    entidadTipo: 'caja',
    entidadId: cierre.id,
    detalle: `Reapertura de caja aprobada para ${cierre.cobrador?.nombre ?? ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  notificar({
    organizationId, para: cierre.cobradorId, tipo: 'reapertura_aprobada',
    titulo: 'Ya puedes reabrir tu caja',
    mensaje: `${session.user.nombre} aprobó la reapertura. Ya puedes seguir registrando abonos.`,
    href: '/caja', datos: { cierreId: cierre.id },
  })

  return Response.json(cierreActualizado, { status: 200 })
}
