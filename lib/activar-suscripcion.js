// lib/activar-suscripcion.js — Activador de plan compartido entre pasarelas
//
// Encapsula la logica de activar/renovar una suscripcion pagada, sin importar
// la pasarela (MercadoPago, Wompi). Reusa las reglas del webhook de MercadoPago:
// idempotencia por id de pago, vencimiento segun periodo, extension desde la
// fecha actual si sigue activa, update del plan de la organizacion, recompensa
// de referido (solo primer pago) y email de confirmacion.

import { prisma } from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado, emailReferidoExitoso } from '@/lib/email'
import { registrarAdminLog } from '@/lib/admin-log'
import { PLANES_VALIDOS } from '@/lib/planes'

export function sanitizarPlan(planRaw, fallback = 'basic') {
  if (!planRaw) return fallback
  const normalizado = String(planRaw).toLowerCase().trim()
  if (PLANES_VALIDOS.includes(normalizado)) return normalizado
  console.warn('[activar-suscripcion] Plan desconocido: ' + planRaw + ' - fallback: ' + fallback)
  return fallback
}

const DIAS_PERIODO = { anual: 365, trimestral: 90, mensual: 30 }

/**
 * Activa/renueva una suscripcion pagada. Idempotente por gatewayId.
 *
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.plan        plan crudo (se sanitiza)
 * @param {string} [p.periodo]   'mensual' | 'trimestral' | 'anual'
 * @param {number} [p.montoCOP]  monto pagado
 * @param {'wompi'|'mercadopago'} p.gateway
 * @param {string} p.gatewayId   id de la transaccion en la pasarela (idempotencia)
 * @param {string} [p.referencia] referencia enviada a la pasarela (Wompi)
 * @returns {Promise<{ok:boolean, yaProcesado?:boolean, plan?:string, fechaVencimiento?:Date}>}
 */
export async function activarPlanPagado({ organizationId, plan: planRaw, periodo = 'mensual', montoCOP = 0, gateway, gatewayId, referencia }) {
  if (!organizationId) return { ok: false }
  const plan = sanitizarPlan(planRaw)
  const idStr = String(gatewayId)

  // Idempotencia: si ya procesamos este pago, no extender ni recompensar de nuevo.
  const yaProcesado = await prisma.suscripcion.findFirst({
    where: gateway === 'wompi'
      ? { wompiTransactionId: idStr }
      : { mercadopagoId: idStr },
  })
  if (yaProcesado) {
    return { ok: true, yaProcesado: true }
  }

  const ahora         = new Date()
  const diasExtension = DIAS_PERIODO[periodo] ?? 30
  const vencimiento   = new Date(ahora)
  vencimiento.setDate(vencimiento.getDate() + diasExtension)

  // Suscripcion existente real (ignorar las pending de MP nunca completadas).
  const subExistente = await prisma.suscripcion.findFirst({
    where: {
      organizationId,
      OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
    },
    orderBy: { fechaVencimiento: 'desc' },
  })

  const camposGateway = gateway === 'wompi'
    ? { gatewayPago: 'wompi', wompiTransactionId: idStr, ...(referencia && { wompiReference: referencia }) }
    : { gatewayPago: 'mercadopago', mercadopagoId: idStr }

  let fechaVencFinal = vencimiento

  if (subExistente) {
    const baseDate = subExistente.estado === 'activa' && new Date(subExistente.fechaVencimiento) > ahora
      ? new Date(subExistente.fechaVencimiento)
      : ahora
    const nuevaFecha = new Date(baseDate)
    nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension)
    fechaVencFinal = nuevaFecha

    await prisma.suscripcion.update({
      where: { id: subExistente.id },
      data: { plan, estado: 'activa', fechaVencimiento: nuevaFecha, montoCOP, ...camposGateway },
    })
  } else {
    await prisma.suscripcion.create({
      data: {
        organizationId, plan, estado: 'activa',
        fechaInicio: ahora, fechaVencimiento: vencimiento, montoCOP,
        ...camposGateway,
      },
    })
  }

  await prisma.organization.update({
    where: { id: organizationId },
    data: { plan, activo: true },
  })

  // ─── Recompensa de referido (solo primer pago de la org) ───
  const orgData = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { referidoPorId: true },
  })
  if (orgData?.referidoPorId) {
    const pagosAnteriores = await prisma.suscripcion.count({ where: { organizationId } })
    if (pagosAnteriores <= 1) {
      const subReferidor = await prisma.suscripcion.findFirst({
        where: {
          organizationId: orgData.referidoPorId,
          OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
        },
        orderBy: { fechaVencimiento: 'desc' },
      })
      if (subReferidor) {
        const baseRef = subReferidor.estado === 'activa' && new Date(subReferidor.fechaVencimiento) > ahora
          ? new Date(subReferidor.fechaVencimiento)
          : ahora
        const nuevaFechaRef = new Date(baseRef)
        nuevaFechaRef.setDate(nuevaFechaRef.getDate() + 30)
        await prisma.suscripcion.update({
          where: { id: subReferidor.id },
          data: { fechaVencimiento: nuevaFechaRef },
        })
        const ownerRef = await prisma.user.findFirst({
          where: { organizationId: orgData.referidoPorId, rol: 'owner' },
          select: { id: true, nombre: true, email: true, emailsMarketing: true },
        })
        if (ownerRef && ownerRef.emailsMarketing) {
          const orgReferida = await prisma.organization.findUnique({
            where: { id: organizationId },
            select: { nombre: true },
          })
          const { subject: sRef, html: hRef } = emailReferidoExitoso({
            nombre: ownerRef.nombre,
            nombreReferido: orgReferida?.nombre || 'Un referido',
            userId: ownerRef.id,
          })
          enviarEmail({ to: ownerRef.email, subject: sRef, html: hRef }).catch(e => console.error('[Email] Fallo envio:', e.message))
        }
      }
    }
  }

  await registrarAdminLog({
    organizacionId: organizationId,
    accion:         'pago_aprobado',
    detalle:        `Pago aprobado por ${gateway} #${idStr}. Plan: ${plan}. Monto: $${montoCOP}`,
  })

  const owner = await prisma.user.findFirst({
    where: { organizationId, rol: 'owner' },
    select: { nombre: true, email: true },
  })
  if (owner) {
    const { subject, html } = emailPagoAprobado({
      nombre: owner.nombre,
      plan,
      monto: montoCOP,
      fechaVencimiento: fechaVencFinal,
    })
    enviarEmail({ to: owner.email, subject, html }).catch(e => console.error('[Email] Fallo envio:', e.message))
  }

  return { ok: true, plan, fechaVencimiento: fechaVencFinal }
}
