import { prisma } from '@/lib/prisma'
import { enviarEmail, emailPagoAprobado, emailReferidoExitoso } from '@/lib/email'
import { registrarAdminLog } from '@/lib/admin-log'
import { registrarPagoSuscripcion } from '@/lib/libro-pagos'
import { PLANES_VALIDOS, admiteAdicionales } from '@/lib/planes'
import { montoAdicionalesDelPago } from '@/lib/precio-plan'

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

/* ══ LOS ADICIONALES QUEDAN EN LO QUE SE PAGÓ ═══════════════════════════════
 *
 * · Un plan que no los admite (Inicial, Básico) los pone en CERO. Si no, bajar
 *   de Crecimiento a Básico los dejaba en la columna y volver a subir meses
 *   después los traía al cobro sin que nadie los pidiera.
 * · Un pago que dice con cuántos se cobró (`conAdicionales`, de la referencia)
 *   los deja en ESO COMO MUCHO. Sin esto, abrir un checkout de $79.000, subir a
 *   diez cobradores en otra pestaña (sin plan pagado se eligen libres) y pagar
 *   el checkout viejo daba diez cobradores por el precio del plan solo
 *   (revisión del 24 sep 2026). Nunca sube: lo que se compró aparte mientras el
 *   cobro iba en vuelo no se regala, y lo que no se pagó no se queda.
 * · Una referencia vieja, sin el dato, no los toca. */
async function adicionalesTrasPago(tx, organizationId, plan, conAdicionales) {
  if (!admiteAdicionales(plan)) return { cobradoresAdicionales: 0, rutasAdicionales: 0 }
  /* El cobro automático no recorta: si mientras iba en vuelo se compró uno
     aparte, ése está pagado hasta el vencimiento y no se quita (revisión del
     24 sep 2026). Subir gratis en vuelo lo impide `cambiarAdicionales`. */
  if (!conAdicionales || conAdicionales.automatico) return {}
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { cobradoresAdicionales: true, rutasAdicionales: true },
  })
  return {
    cobradoresAdicionales: Math.min(org?.cobradoresAdicionales ?? 0, conAdicionales.cobradores ?? 0),
    rutasAdicionales: Math.min(org?.rutasAdicionales ?? 0, conAdicionales.rutas ?? 0),
  }
}

/* ⚠ UN PAGO QUE ENTRA DEJA EL COBRO AL DÍA, venga de donde venga (el cobro
   automático, el checkout, MercadoPago). Borra el rechazo que cerraba el acceso
   y el cobro en vuelo: si éste llegara a aprobarse tarde, el webhook lo activa
   igual; si llegara a rechazarse tarde, ya no hay a quién cerrarle nada por un
   periodo que está pagado. Ver lib/cobro-intento.js. */
const COBRO_AL_DIA = {
  cobroFallos: 0,
  cobroRechazoVence: null,
  cobroRechazoMotivo: null,
  cobroRefPendiente: null,
  cobroTxPendiente: null,
}

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
 * @param {{cobradores:number, rutas:number}} [p.conAdicionales] con cuántos adicionales se cobró (de la referencia)
 * @param {string} [p.country]       para el precio de los adicionales (Wompi: siempre `co`)
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
  conAdicionales = null,
  country = 'co',
}) {
  if (!organizationId) return { ok: false }
  const plan = sanitizarPlan(planRaw)
  /* Cuánto de este pago fue de adicionales: «por revisar» mira solo el resto. */
  const montoAdicionales = montoAdicionalesDelPago(conAdicionales, plan, periodo, montoCOP, country)
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

      /* El apunte en el libro, ANTES de tocar la suscripción.
         Va aquí dentro a propósito: la fila de abajo pisa `montoCOP` y el id de
         la transacción, y con eso desaparecía el rastro del pago anterior. Si
         esto falla, la transacción entera se cae y no se da servicio sin
         registrar la plata. Ver lib/libro-pagos.js. */
      await registrarPagoSuscripcion(tx, {
        organizationId,
        plan,
        montoCOP,
        periodo,
        gateway,
        gatewayId: idStr,
        referencia,
      })

      // Buscar suscripcion existente (ignorar pending de MP nunca completadas)
      /* ══ LOS CHECKOUTS ABIERTOS SE CIERRAN CON EL PAGO ═══════════════════
         Cada vez que alguien abre el checkout de Wompi nace una fila
         `pendiente` (ver /api/pagos/wompi/crear), y el pago activaba la fila
         original sin tocar las otras: 64 filas huérfanas en 26 negocios,
         «pendientes» con vencimiento en el pasado, y un cliente que abrió tres
         checkouts seguidos antes de que uno pasara. Cualquier consulta que
         no filtre por estado se las encuentra. Al activar, se cancelan. */
      await tx.suscripcion.updateMany({
        where: { organizationId, estado: 'pendiente', mpStatus: 'pending', gatewayPago: 'wompi' },
        data: { estado: 'cancelada', canceladaAt: ahora, motivoCancelacion: 'checkout no completado; el pago entró por otro' },
      })

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
            montoAdicionales,
            ...camposGateway,
          },
        })
        await tx.organization.update({
          where: { id: organizationId },
          data: { plan, activo: true, waChurnSent: false, waPreVencSent: false, ...COBRO_AL_DIA, ...(await adicionalesTrasPago(tx, organizationId, plan, conAdicionales)) },
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
          montoAdicionales,
          ...camposGateway,
        },
      })
      await tx.organization.update({
        where: { id: organizationId },
        data: { plan, activo: true, waChurnSent: false, waPreVencSent: false, ...COBRO_AL_DIA, ...(await adicionalesTrasPago(tx, organizationId, plan, conAdicionales)) },
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
