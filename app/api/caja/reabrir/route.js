// app/api/caja/reabrir/route.js
// Reabre el cierre de caja del dia para que el cobrador pueda seguir
// registrando pagos. Deja rastro de quien y cuando lo reabrio.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, id: userId } = session.user
  const body = await request.json()

  const cobradorId = rol === 'owner' ? (body.cobradorId ?? userId) : userId
  if (rol !== 'owner' && cobradorId !== userId) {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const fechaLocal = typeof body.fecha === 'string' && FECHA_REGEX.test(body.fecha)
    ? body.fecha
    : getLocalDateStr()

  const { inicio, fin } = getLocalDayRange(fechaLocal)

  const cierre = await prisma.cierreCaja.findFirst({
    where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } },
  })
  if (!cierre) return Response.json({ error: 'No hay cierre registrado para esta fecha' }, { status: 404 })
  if (cierre.reabiertoEn) return Response.json(cierre, { status: 200 })

  const cobrador = await prisma.user.findFirst({
    where: { id: cobradorId, organizationId },
    select: { nombre: true },
  })

  const cierreActualizado = await prisma.cierreCaja.update({
    where: { id: cierre.id },
    data: { reabiertoEn: new Date(), reabiertoPorId: userId },
  })

  logActividad({
    session,
    accion: 'reapertura_cierre_caja',
    entidadTipo: 'caja',
    entidadId: cierre.id,
    detalle: `Reapertura de caja ${cobrador?.nombre ?? ''} (${fechaLocal})`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json(cierreActualizado, { status: 200 })
}
