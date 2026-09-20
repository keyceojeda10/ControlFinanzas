// app/api/caja/reabrir/route.js
// Reabre el cierre de caja del dia para que el cobrador pueda seguir
// registrando pagos. Deja rastro de quien y cuando lo reabrio.
//
// - Owner: reabre directo (y limpia cualquier solicitud pendiente).
// - Cobrador con permiso `reabrirCajaSinAprobacion`: reabre directo, se avisa al owner.
// - Cobrador sin ese permiso: queda como SOLICITUD pendiente de aprobacion
//   (la caja sigue cerrada hasta que el owner apruebe).

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'
import { notificar } from '@/lib/notificar'

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
    select: { nombre: true, puedeReabrirCajaSinAprobacion: true },
  })

  // Cobrador sin permiso: crea/actualiza la solicitud pendiente, NO reabre.
  if (rol === 'cobrador' && !cobrador?.puedeReabrirCajaSinAprobacion) {
    if (cierre.solicitudReaperturaEn) return Response.json(cierre, { status: 200 })

    const cierreActualizado = await prisma.cierreCaja.update({
      where: { id: cierre.id },
      data: { solicitudReaperturaEn: new Date(), solicitudReaperturaPorId: userId },
    })

    logActividad({
      session,
      accion: 'solicitud_reapertura_cierre_caja',
      entidadTipo: 'caja',
      entidadId: cierre.id,
      detalle: `Solicitud de reapertura de caja ${cobrador?.nombre ?? ''} (${fechaLocal})`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    // Campana Y teléfono: con solo el push, el dueño con el teléfono apagado no
    // se enteraba nunca y el cobrador se quedaba sin poder registrar abonos.
    notificar({
      organizationId, para: 'owners', tipo: 'solicitud_reapertura',
      titulo: 'Piden reabrir una caja',
      mensaje: `${session.user.nombre} pide reabrir su caja del ${fechaLocal} para seguir registrando abonos.`,
      href: '/caja', datos: { cierreId: cierre.id },
    })

    return Response.json(cierreActualizado, { status: 200 })
  }

  // Owner, o cobrador con permiso: reabre directo.
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
    accion: 'reapertura_cierre_caja',
    entidadTipo: 'caja',
    entidadId: cierre.id,
    detalle: `Reapertura de caja ${cobrador?.nombre ?? ''} (${fechaLocal})`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  // Si fue el cobrador quien reabrio su propia caja (con permiso), avisar al/los owner(s).
  if (rol === 'cobrador') {
    notificar({
      organizationId, para: 'owners', tipo: 'caja_reabierta',
      titulo: 'Caja reabierta',
      mensaje: `${session.user.nombre} reabrió su caja del ${fechaLocal} para seguir registrando abonos.`,
      href: '/caja', datos: { cierreId: cierre.id },
    })
  }

  return Response.json(cierreActualizado, { status: 200 })
}
