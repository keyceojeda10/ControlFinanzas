// lib/activity-log.js — Helper para registrar actividad de usuarios (audit trail)
import { prisma } from '@/lib/prisma'
export { ACCIONES } from '@/lib/activity-log-types'

export function logActividad({ session, accion, entidadTipo, entidadId, detalle, ip }) {
  if (!session?.user?.id || !session?.user?.organizationId) return

  prisma.actividadLog.create({
    data: {
      organizationId: session.user.organizationId,
      userId: session.user.id,
      accion,
      entidadTipo,
      entidadId: entidadId || undefined,
      detalle: detalle || undefined,
      ip: ip || undefined,
    },
  }).catch((err) => {
    console.error('[activity-log] Error:', err.message)
  })
}
