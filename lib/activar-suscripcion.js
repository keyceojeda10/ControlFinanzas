import { prisma } from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado, emailReferidoExitoso } from '@/lib/email'
import { registrarAdminLog } from '@/lib/admin-log'
import { PLANES_VALIDOS } from '@/lib/planes'

export function sanitizarPlan(planRaw, fallback = 'basic') {
  if (!planRaw) return fallback
  const normalizado = String(planRaw).toLowerCase().trim()
  if (PLANES_VALIDOS.includes(normalizado)) return normalizado
  console.warn(
    '\n########## [activar-suscripcion] PLAN INVALIDO ##########\n' +
    '  planRecibido: ' + JSON.stringify(planRaw) + '\n' +
    '  planesValidos: ' + PLANES_VALIDOS.join(', ') + '\n' +
    '  fallbackAplicado: ' + fallback + '\n' +
    '#########################################################\n'
  )
  return fallback
}

const DIAS_PERIODO = { anual: 365, trimestral: 90, mensual: 30 }

/**
 * Activa o renueva una suscripcion pagada. Idempotente por gatewayId.
 * Compartido entre MercadoPago y Wompi.
 *
 * @param {object} p
 * @param {string} p.organizationId
 * @param {string} p.plan            plan crudo (se sanitiza)
 * @param {string} [p.periodo]       'mensual' | 'trimestral' | 'anual'
 * @param {number} [p.montoCOP]      monto pagado
 * @param {'mercadopago'|'wompi'} p.gateway
 * @param {string} p.gatewayId       id de la transaccion (idempotencia)
 * @param {string} [p.referencia]    referencia Wompi (opcional)
 * @returns {Promise<{ok:boolean, yaProcesado?:boolean, plan?:string, fechaVencimiento?:Date}>}
 */
export async function activarPlanPagado({
  organizationId,
  plan: planRaw,
  periodo = 'mensual',
  montoCOP = 0,
  gateway,
  gatewayId,
  referencia,
}) {
  if (!organizationId) return { ok: false }
  const plan = sanitizarPlan(planRaw)
  const idStr = String(gatewayId)

  const ahora = new Date()
  const diasExtension = DIAS_PERIODO[periodo] ?? 30
  const vencimiento = new Date(ahora)
  vencimiento.setDate(vencimiento.getDate() + diasExtension)

  const camposGateway = gateway === 'wompi'
    ? { gatewayPago: 'wompi', wompiTransactionId: idStr, ...(referencia && { wompiReference: referencia }) }
    : { gatewayPago: 'mercadopago', mercadopagoId: idStr }

  let subFinal = null
  let yaProcesado = false

  try {
    subFinal = await prisma.$transaction(async (tx) => {
      // Idempotencia: verificar si ya procesamos este pago
      const whereIdempotencia = gateway === 'wompi'
        ? { wompiTransactionId: idStr }
        : { mercadopagoId: idStr }
      const procesado = await tx.suscripcion.findFirst({ where: whereIdempotencia })
      if (procesado) {
        yaProcesado = true
        return procesado
      }

      // Buscar suscripcion existente (ignorar pending de MP nunca completadas)
      const sub = await tx.suscripcion.findFirst({
        where: {
          organizationId,
          OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
        },
        orderBy: { fechaVencimiento: 'desc' },
      })

      if (sub) {
        const baseDate = sub.estado === 'activa' && new Date(sub.fechaVencimiento) > ahora
          ? new Date(sub.fechaVencimiento)
          : ahora
        const nuevaFecha = new Date(baseDate)
        nuevaFecha.setDate(nuevaFecha.getDate() + diasExtension)

        const actualizada = await tx.suscripcion.update({
          where: { id: sub.id },
          data: {
            plan,
            estado: 'activa',
            fechaVencimiento: nuevaFecha,
            montoCOP,
            ...camposGateway,
          },
        })
        await tx.organization.update({
          where: { id: organizationId },
          data: { plan, activo: true, waChurnSent: false, waPreVencSent: false },
        })
        return actualizada
      }

      const creada = await tx.suscripcion.create({
        data: {
          organizationId,
          plan,
          estado: 'activa',
          fechaInicio: ahora,
          fechaVencimiento: vencimiento,
          montoCOP,
          ...camposGateway,
        },
      })
      await tx.organization.update({
        where: { id: organizationId },
        data: { plan, activo: true, waChurnSent: false, waPreVencSent: false },
      })
      return creada
    }, { isolation: 'Serializable' })
  } catch (txErr) {
    console.warn('[activar-suscripcion] conflicto de concurrencia para ' + gateway + ' ' + idStr + ', tratando como ya procesado: ' + txErr.message)
    return { ok: true, yaProcesado: true }
  }

  if (yaProcesado) {
    console.log('[activar-suscripcion] ' + gateway + ' ' + idStr + ' ya procesado, ignorando')
    return { ok: true, yaProcesado: true }
  }

  // Recompensa de referido (solo primer pago de la org)
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
        console.log('[activar-suscripcion] +30 dias para referidor org=' + orgData.referidoPorId + ' por referido org=' + organizationId)

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

  const fechaVencFinal = subFinal?.fechaVencimiento ?? vencimiento

  await registrarAdminLog({
    organizacionId: organizationId,
    accion: 'pago_aprobado',
    detalle: `Pago aprobado por ${gateway} #${idStr}. Plan: ${plan}. Monto: $${montoCOP}`,
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
