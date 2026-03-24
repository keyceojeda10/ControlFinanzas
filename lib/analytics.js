// lib/analytics.js — Helper para tracking de eventos de uso
import { prisma } from '@/lib/prisma'

/**
 * Registra un evento de uso (fire-and-forget)
 * @param {object} params
 * @param {string} [params.organizationId]
 * @param {string} [params.userId]
 * @param {string} params.evento - Tipo de evento (page_view, crear_prestamo, etc.)
 * @param {string} [params.pagina] - Pathname de la página
 * @param {object} [params.metadata] - Datos extra en JSON
 */
export function trackEvent({ organizationId, userId, evento, pagina, metadata }) {
  prisma.evento.create({
    data: {
      organizationId: organizationId || undefined,
      userId: userId || undefined,
      evento,
      pagina: pagina || undefined,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    },
  }).catch((err) => {
    console.error('[analytics] Error:', err.message)
  })
}
