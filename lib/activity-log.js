// lib/activity-log.js — Helper para registrar actividad de usuarios (audit trail)
import { prisma } from '@/lib/prisma'

/**
 * Registra una acción en el log de actividad (fire-and-forget)
 * @param {object} params
 * @param {object} params.session - Session de NextAuth (debe tener user.id y user.organizationId)
 * @param {string} params.accion - Tipo de acción (crear_prestamo, registrar_pago, etc.)
 * @param {string} params.entidadTipo - Tipo de entidad (prestamo, pago, cliente, etc.)
 * @param {string} [params.entidadId] - ID de la entidad afectada
 * @param {string} [params.detalle] - Descripción legible de la acción
 * @param {string} [params.ip] - IP del usuario
 */
export function logActividad({ session, accion, entidadTipo, entidadId, detalle, ip }) {
  if (!session?.user?.id || !session?.user?.organizationId) return

  // Fire-and-forget: no bloquea la respuesta
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

// Mapeo de acciones a descripciones legibles para la UI
export const ACCIONES = {
  crear_prestamo:    { label: 'Creó préstamo',        icon: 'banknotes',   color: '#22c55e' },
  editar_prestamo:   { label: 'Editó préstamo',       icon: 'pencil',      color: '#f59e0b' },
  eliminar_prestamo: { label: 'Eliminó préstamo',     icon: 'trash',       color: '#ef4444' },
  registrar_pago:    { label: 'Registró pago',        icon: 'check',       color: '#22c55e' },
  crear_cliente:     { label: 'Creó cliente',          icon: 'user-plus',   color: '#3b82f6' },
  editar_cliente:    { label: 'Editó cliente',         icon: 'pencil',      color: '#f59e0b' },
  eliminar_cliente:  { label: 'Eliminó cliente',       icon: 'trash',       color: '#ef4444' },
  crear_ruta:        { label: 'Creó ruta',             icon: 'map',         color: '#8b5cf6' },
  crear_cobrador:    { label: 'Creó cobrador',         icon: 'user-plus',   color: '#8b5cf6' },
  cierre_caja:       { label: 'Cerró caja',            icon: 'calculator',  color: '#f59e0b' },
  movimiento_capital:{ label: 'Movimiento de capital', icon: 'arrows',      color: '#3b82f6' },
  registrar_gasto:   { label: 'Registró gasto',        icon: 'receipt',     color: '#ef4444' },
}
