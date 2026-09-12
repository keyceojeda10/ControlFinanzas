// lib/cobro-intento.js — mandar un cobro con el medio guardado, y saber cómo acabó.
//
// ══ POR QUÉ HAY UN SOLO CAMINO ═════════════════════════════════════════════
//
// Cobran tres sitios: el cron del día, el «Guardar» del medio de pago y el
// botón «Reintentar» de la pantalla de suscripción vencida. Cada uno tenía su
// propio candado y su propia forma de contar un rechazo, y un rechazo contado
// mal es, desde el 12 sep 2026, un negocio que se queda dentro sin pagar:
//
//   «si no, lo que van a hacer es colocar la X, como no cobra nada, no se hace
//    el pago y ellos siguen dentro de la plataforma, y eso no se puede permitir»
//
// ══ LAS TRES REGLAS ════════════════════════════════════════════════════════
//
// 1. **Un cobro en vuelo a la vez.** `cobroRefPendiente` se escribe con un
//    `updateMany` condicionado ANTES de llamar a Wompi. Si dos pulsaciones o el
//    cron y el botón llegan a la vez, solo una lo consigue. Se borra cuando la
//    transacción termina, y si nunca llega a saberse, `reconciliar` la busca.
//
// 2. **El rechazo se apunta una vez.** Wompi puede decirlo en la respuesta, en
//    el webhook y en la consulta: `contarRechazo` solo escribe si la referencia
//    sigue siendo la que está en vuelo, y al escribir la borra.
//
// 3. **No se activa nada aquí salvo por `activarPlanPagado`**, que es idempotente
//    por id de transacción. El webhook activa; `reconciliar` también puede,
//    porque si el webhook no llega el cliente pagó y sigue fuera.

import { prisma } from '@/lib/prisma'
import {
  cobrarConFuente, consultarTransaccion, transaccionPorReferencia,
  referenciaDeCobro, leerReferencia,
} from '@/lib/wompi'
import { activarPlanPagado } from '@/lib/activar-suscripcion'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'
import { rechazoVigente, HORAS_DE_ANTICIPO } from '@/lib/cobro-automatico'

/* Los estados finales que no son dinero. */
export const ESTADOS_RECHAZO = new Set(['DECLINED', 'ERROR', 'VOIDED'])

/* Un cobro que se mandó y del que Wompi no sabe nada pasado este tiempo no
   salió: se libera para poder intentarlo de nuevo. */
const MINUTOS_SIN_RASTRO = 30

const selectOrgCobro = {
  id: true, nombre: true, plan: true, planOriginal: true, descuento: true, country: true,
  wompiFuentePagoId: true, wompiFuenteEmail: true, cobroAutomatico: true,
  cobroFallos: true, cobroUltimoIntento: true,
  cobroRefPendiente: true, cobroTxPendiente: true,
  cobroRechazoVence: true, cobroRechazoMotivo: true,
}

/* La MISMA suscripción que miran el layout, `lib/suscripcion.js` y el login: la
   más reciente que no sea un checkout de MercadoPago a medias. El rechazo se
   compara contra su fecha, así que tiene que ser la misma. */
export function ultimaSuscripcion(organizationId) {
  return prisma.suscripcion.findFirst({
    where: { organizationId, OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
    orderBy: { fechaVencimiento: 'desc' },
    select: { plan: true, estado: true, montoCOP: true, fechaVencimiento: true },
  })
}

async function liberar(orgId, referencia) {
  await prisma.organization.updateMany({
    where: { id: orgId, cobroRefPendiente: referencia },
    data: { cobroRefPendiente: null, cobroTxPendiente: null },
  })
}

/**
 * La pasarela dijo que no. Cierra el acceso al vencer: apunta el vencimiento
 * que había, suma un fallo y libera el cobro en vuelo. Idempotente: si la
 * referencia ya no está en vuelo (se contó antes, o entró un pago), no hace nada.
 */
export async function contarRechazo(orgId, referencia, motivo) {
  if (!orgId || !referencia) return false
  const sub = await ultimaSuscripcion(orgId)
  const texto = String(motivo ?? '').trim().slice(0, 190)
  const r = await prisma.organization.updateMany({
    where: { id: orgId, cobroRefPendiente: referencia },
    data: {
      cobroFallos: { increment: 1 },
      cobroRechazoVence: sub?.fechaVencimiento ?? new Date(),
      cobroRechazoMotivo: texto || null,
      cobroRefPendiente: null,
      cobroTxPendiente: null,
    },
  })
  if (r.count > 0) {
    console.warn(`[cobro] RECHAZADO org ${orgId} ref ${referencia}: ${texto || '(sin motivo)'} — el acceso se cierra al vencer`)
  }
  return r.count > 0
}

/**
 * Manda UN cobro. `org` necesita `id`, `nombre`, `wompiFuentePagoId` y
 * `wompiFuenteEmail`.
 *
 * @returns {Promise<{resultado: 'pendiente'|'enviado'|'rechazado'|'error', id?: string, motivo?: string}>}
 */
export async function lanzarCobro({ org, plan, montoCOP, reiniciarFallos = false, origen = 'cobro' }) {
  const ahora = new Date()
  const referencia = referenciaDeCobro(org.id, plan, 'mensual')

  /* ⚠ EL CANDADO, ANTES DE WOMPI. Si se apuntara después, el peor caso de una
     caída a mitad sería cobrar dos veces; así, es no reintentar hasta que
     `reconciliar` averigüe qué pasó. */
  const candado = await prisma.organization.updateMany({
    where: { id: org.id, cobroRefPendiente: null },
    data: {
      cobroUltimoIntento: ahora,
      cobroRefPendiente: referencia,
      cobroTxPendiente: null,
      /* Un rechazo de un periodo que ya pasó no cuenta para este. */
      ...(reiniciarFallos && { cobroFallos: 0, cobroRechazoVence: null, cobroRechazoMotivo: null }),
    },
  })
  if (candado.count === 0) return { resultado: 'pendiente' }

  let r
  try {
    r = await cobrarConFuente({
      fuenteId: org.wompiFuentePagoId,
      montoCOP,
      email: org.wompiFuenteEmail,
      referencia,
    })
  } catch (e) {
    /* No se sabe si salió (la red se cortó con la petición mandada). Queda en
       vuelo y `reconciliar` lo busca por la referencia. */
    console.error(`[cobro:${origen}] error llamando a Wompi para "${org.nombre}": ${e.message} — ref ${referencia} queda en vuelo`)
    return { resultado: 'error', motivo: e.message }
  }

  if (!r.ok) {
    /* Nuestra llave o el límite de peticiones: el cobro no existió y no es
       culpa del cliente. */
    if ([401, 403, 429].includes(r.http)) {
      await liberar(org.id, referencia)
      console.error(`[cobro:${origen}] Wompi no aceptó la petición de "${org.nombre}" (HTTP ${r.http}): ${r.motivo}`)
      return { resultado: 'error', motivo: r.motivo }
    }
    /* Wompi caído: pudo crearse o no. En vuelo hasta que se sepa. */
    if (!r.http || r.http >= 500) {
      console.error(`[cobro:${origen}] Wompi falló con "${org.nombre}" (HTTP ${r.http}): ${r.motivo} — ref ${referencia} queda en vuelo`)
      return { resultado: 'error', motivo: r.motivo }
    }
    await contarRechazo(org.id, referencia, r.motivo)
    return { resultado: 'rechazado', motivo: r.motivo }
  }

  if (ESTADOS_RECHAZO.has(r.estado)) {
    await contarRechazo(org.id, referencia, r.mensaje || r.estado)
    return { resultado: 'rechazado', id: String(r.id), motivo: r.mensaje || r.estado }
  }

  await prisma.organization.updateMany({
    where: { id: org.id, cobroRefPendiente: referencia },
    data: { cobroTxPendiente: String(r.id) },
  })
  /* Aceptado NO es cobrado: nace PENDING. Lo cierra el webhook o `reconciliar`. */
  console.log(`[cobro:${origen}] enviado ${plan} $${montoCOP} de "${org.nombre}" — tx ${r.id} (${r.estado}) ref ${referencia}`)
  return { resultado: 'enviado', id: String(r.id), estado: r.estado }
}

/**
 * ¿Cómo acabó el cobro en vuelo? Pregunta a Wompi y deja la organización como
 * corresponde. `org` necesita `id`, `cobroRefPendiente`, `cobroTxPendiente` y
 * `cobroUltimoIntento`.
 *
 * @returns {Promise<'libre'|'pendiente'|'aprobada'>} 'libre' = se puede cobrar.
 */
export async function reconciliar(org) {
  const referencia = org?.cobroRefPendiente
  if (!referencia) return 'libre'

  let tx = null
  try {
    if (org.cobroTxPendiente) {
      tx = await consultarTransaccion(org.cobroTxPendiente)
      /* Se sabe que existe: si la consulta no contesta, no se libera. */
      if (!tx) return 'pendiente'
    } else {
      tx = await transaccionPorReferencia(referencia)
    }
  } catch (e) {
    console.error(`[cobro] no pude consultar el cobro en vuelo de org ${org.id}: ${e.message}`)
    return 'pendiente'
  }

  if (!tx) {
    const desde = org.cobroUltimoIntento ? new Date(org.cobroUltimoIntento).getTime() : 0
    if (Date.now() - desde < MINUTOS_SIN_RASTRO * 60000) return 'pendiente'
    await liberar(org.id, referencia)
    console.warn(`[cobro] ref ${referencia} de org ${org.id} no existe en Wompi: se libera`)
    return 'libre'
  }

  if (tx.reference && tx.reference !== referencia) {
    console.error(`[cobro] la tx ${tx.id} trae la referencia ${tx.reference} y se esperaba ${referencia} (org ${org.id})`)
    return 'pendiente'
  }

  if (ESTADOS_RECHAZO.has(tx.status)) {
    await contarRechazo(org.id, referencia, tx.status_message || tx.status)
    return 'libre'
  }

  if (tx.status !== 'APPROVED') return 'pendiente'

  const parsed = leerReferencia(referencia)
  if (!parsed || parsed.orgId !== org.id) {
    console.error(`[cobro] APROBADO con referencia que no es de org ${org.id}: ${referencia}`)
    return 'pendiente'
  }
  try {
    await activarPlanPagado({
      organizationId: parsed.orgId,
      plan: parsed.plan,
      periodo: parsed.periodo,
      montoCOP: Math.round((tx.amount_in_cents ?? 0) / 100),
      gateway: 'wompi',
      gatewayId: tx.id,
      referencia,
    })
  } catch (e) {
    console.error(`[cobro] APROBADO pero falló la activación de org ${org.id} (tx ${tx.id}): ${e.message}`)
  }
  /* `activarPlanPagado` dice «ya procesado» también cuando su transacción
     falla. Lo que cuenta es que la suscripción lleve este pago. */
  const aplicada = await prisma.suscripcion.findFirst({
    where: { wompiTransactionId: String(tx.id) },
    select: { id: true },
  })
  if (!aplicada) {
    console.error(`[cobro] PAGO APROBADO SIN APLICAR: tx ${tx.id} de org ${org.id} — revisar a mano`)
    return 'pendiente'
  }
  await liberar(org.id, referencia)
  return 'aprobada'
}

/**
 * Cobra ahora si hace falta. Lo usan «Guardar medio de pago» y «Reintentar».
 * El cron no: ése tiene su ventana y su plan.
 *
 * @returns {Promise<{resultado: string, id?: string, motivo?: string, segundos?: number}>}
 *   'sin-medio' | 'no-hace-falta' | 'pendiente' | 'aprobado' | 'espera' |
 *   'sin-plan' | 'enviado' | 'rechazado' | 'error'
 */
export async function cobrarAhoraSiToca({ orgId, planElegido = null, minutosEntreIntentos = 2, origen = 'manual' }) {
  let org = await prisma.organization.findUnique({ where: { id: orgId }, select: selectOrgCobro })
  if (!org?.cobroAutomatico || org.wompiFuentePagoId == null || !org.wompiFuenteEmail) {
    return { resultado: 'sin-medio' }
  }

  if (org.cobroRefPendiente) {
    const estado = await reconciliar(org)
    if (estado === 'aprobada') return { resultado: 'aprobado' }
    if (estado !== 'libre') return { resultado: 'pendiente' }
    org = await prisma.organization.findUnique({ where: { id: orgId }, select: selectOrgCobro })
    if (!org) return { resultado: 'sin-medio' }
  }

  const ahora = new Date()
  const ultima = await ultimaSuscripcion(orgId)
  const vigente = rechazoVigente(org, ultima?.fechaVencimiento)

  /* Plan de pago que dura más allá del anticipo del cron: el cron lo cobrará a
     su hora. Quien está en prueba o en el plan gratis no tiene ninguno, y a ése
     hay que cobrarle ya, o se «suscribiría» sin que se le cobre nunca. */
  const cubierto = Boolean(
    ultima && ultima.estado === 'activa' && ultima.montoCOP > 0 &&
    new Date(ultima.fechaVencimiento).getTime() > ahora.getTime() + HORAS_DE_ANTICIPO * 3600000
  )
  if (!vigente && cubierto) return { resultado: 'no-hace-falta' }

  /* Un rechazo es dinero que no había: pulsar diez veces seguidas solo suma
     rechazos, y eso ensucia la reputación del comercio con el banco. */
  if (minutosEntreIntentos > 0 && org.cobroUltimoIntento) {
    const falta = new Date(org.cobroUltimoIntento).getTime() + minutosEntreIntentos * 60000 - ahora.getTime()
    if (falta > 0) return { resultado: 'espera', segundos: Math.ceil(falta / 1000) }
  }

  const precioDe = (p) => Math.round(getPrecioPlan(p, org.country ?? 'co') * (1 - (org.descuento ?? 0) / 100))
  let plan = null
  let monto = 0
  if (planElegido && PLANES_CONFIG[planElegido]) {
    plan = planElegido
    monto = precioDe(plan)
  } else {
    /* Lo mismo que cobra el cron: el último plan pagado, a lo que se pagó. */
    const pagada = await prisma.suscripcion.findFirst({
      where: { organizationId: orgId, estado: { in: ['activa', 'vencida'] }, montoCOP: { gt: 0 } },
      orderBy: { fechaVencimiento: 'desc' },
      select: { plan: true, montoCOP: true },
    })
    if (pagada) {
      plan = pagada.plan
      monto = pagada.montoCOP
    } else {
      /* Durante una demo `plan` es el prestado; el suyo está en `planOriginal`. */
      const suyo = org.planOriginal || org.plan
      if (PLANES_CONFIG[suyo]) {
        plan = suyo
        monto = precioDe(plan)
      }
    }
  }
  if (!plan || !(monto > 0)) return { resultado: 'sin-plan' }

  return lanzarCobro({ org, plan, montoCOP: monto, reiniciarFallos: !vigente, origen })
}
