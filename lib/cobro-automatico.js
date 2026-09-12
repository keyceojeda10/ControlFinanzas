// lib/cobro-automatico.js — ¿a este negocio se le cobra solo, y le dejamos entrar?
//
// ══ POR QUÉ VIVE EN UN SOLO SITIO ══════════════════════════════════════════
//
// 12 sep 2026. Un cliente con Nequi guardado y el cobro automático encendido:
//
//   «Yo coloco automáticamente el pago y ahí sale que está automático el cobro
//    con Nequi, pero no ha cobrado nada, y cada rato me sale un anuncio ahí,
//    que debo pagar, que debo pagar, pero yo tengo ya automático eso»
//
// Tenía razón en las dos cosas, y eran tres fallos:
//
//   1. Los avisos de «tu plan vence» solo sabían de la recurrencia VIEJA de
//      MercadoPago (`tipo: 'recurrente'` + `mpStatus: 'authorized'`). Del Nequi
//      o la tarjeta guardados en Wompi no sabía nada ninguno.
//   2. El cron cobraba solo lo que YA había vencido, a las 13:00. Su plan
//      vencía a las 13:10: ese día no se cobraba, y a las 13:10 el sistema lo
//      echaba a «suscripción vencida» con el cobro puesto. (Horas del
//      servidor, que va en UTC: en Colombia son las 08:00 y las 08:10.)
//   3. Peor: a las 08:00 UTC del día siguiente el cron de suscripciones la marca
//      `vencida`, y el cobro solo buscaba `activa`. Quien vencía después de las
//      13:00 NO SE COBRABA NUNCA.
//
// ══ Y EL MISMO DÍA, LA OTRA MITAD ══════════════════════════════════════════
//
// El dueño, al ver el arreglo:
//
//   «se debería cobrar automáticamente un poco antes de que el plan venza, un
//    día antes, por ejemplo […] si Nequi no encuentra dinero y rechaza, el
//    sistema debería de cerrarse […] no dejarle más acceso aunque tenga el
//    medio de pago automático […] porque si no, lo que van a hacer es colocar
//    la X, como no cobra nada, no se hace el pago y ellos siguen dentro de la
//    plataforma, y eso no se puede permitir»
//
// Por eso la gracia ya no es «tener el medio guardado»: es tenerlo guardado
// SIN que la pasarela haya dicho que no. Un rechazo cierra a la hora exacta del
// vencimiento, igual que a quien paga a mano. Ni antes —no se le quitan días
// pagados— ni una hora después.
//
// Cada pantalla y cada cron preguntaba a su manera. Esta es la única respuesta.

/* Tres rechazos seguidos y el cron deja de insistir. Solo frena al cron: el
   dueño puede reintentar desde la pantalla cuando haya recargado. */
export const MAX_FALLOS = 3

/* ⚠ EL COBRO SALE ANTES DE QUE VENZA. El cron pasa una vez al día, así que con
   48 h el primer intento cae entre 24 y 48 h antes del vencimiento y queda una
   pasada más antes de la hora de corte. Si el primero se rechaza por falta de
   saldo, hay un día entero para recargar sin perder ni una hora de acceso.
   Cobrar antes NO le quita días: `activarPlanPagado` extiende desde la fecha de
   vencimiento cuando aún no ha llegado. */
export const HORAS_DE_ANTICIPO = 48

/* Después de vencer se sigue intentando hasta 72 h (con el tope de
   `MAX_FALLOS`), pero ya con el acceso cerrado si hubo rechazo. */
export const HORAS_DE_REINTENTO = 72

/* Horas de acceso más allá del vencimiento, SOLO si la pasarela no ha dicho que
   no: cubre un cron que no pasó, un cobro todavía PENDING o un Wompi caído. Con
   rechazo no hay gracia ninguna. Es corta a propósito: es lo máximo que alguien
   puede quedarse dentro sin que se le haya cobrado. */
export const HORAS_DE_GRACIA = 24

/** Los campos que hay que pedir para `rechazoVigente`, `cobroSinRechazo` y
 *  `vencimientoEfectivo`. */
export const selectCobro = {
  cobroAutomatico: true,
  wompiFuentePagoId: true,
  cobroRechazoVence: true,
}

/** Filtro de Prisma, sobre Organization: medio guardado, cobro encendido y sin
 *  rechazo apuntado. Lo usan los crons de avisos para callarse.
 *  ⚠ Es un poco más estricto que `cobroSinRechazo`: un rechazo de un periodo
 *  ya pagado por otra vía (una extensión del administrador) sigue apuntado
 *  hasta el siguiente cobro, y mientras tanto ese negocio recibe los avisos
 *  normales. Equivocarse hacia «avisar» es barato. */
export const whereCobroSinRechazo = {
  cobroAutomatico: true,
  wompiFuentePagoId: { not: null },
  cobroRechazoVence: null,
}

/** ¿Tiene medio de pago guardado y el cobro encendido? No dice nada de si cobra. */
export function conCobroAutomatico(org) {
  return Boolean(org && org.cobroAutomatico === true && org.wompiFuentePagoId != null)
}

/**
 * ¿La pasarela rechazó el cobro del periodo que vence en `fechaVencimiento`?
 *
 * `cobroRechazoVence` guarda el vencimiento que había cuando se rechazó. El
 * rechazo manda mientras la suscripción no pase de esa fecha: cualquier pago o
 * extensión —Wompi, MercadoPago, el administrador, un referido— la mueve hacia
 * delante y deja el rechazo atrás sin tener que tocar cada uno de esos caminos.
 */
export function rechazoVigente(org, fechaVencimiento) {
  if (!conCobroAutomatico(org) || !org.cobroRechazoVence) return false
  if (!fechaVencimiento) return true
  return new Date(fechaVencimiento).getTime() <= new Date(org.cobroRechazoVence).getTime()
}

/**
 * ¿Se le cobra solo y nada ha fallado? Es lo que calla los avisos y da la gracia.
 * ⚠ Un `select` que no pidió `cobroRechazoVence` dice «no», nunca «sí».
 */
export function cobroSinRechazo(org, fechaVencimiento) {
  if (!conCobroAutomatico(org)) return false
  if (org.cobroRechazoVence === undefined) return false
  return !rechazoVigente(org, fechaVencimiento)
}

/**
 * La fecha a partir de la cual se corta el acceso: la de vencimiento, más la
 * gracia si el cobro está puesto y la pasarela no lo ha rechazado. Devuelve el
 * mismo tipo que recibe (Date o ISO).
 */
export function vencimientoEfectivo(fechaVencimiento, org) {
  if (!fechaVencimiento) return fechaVencimiento
  if (!cobroSinRechazo(org, fechaVencimiento)) return fechaVencimiento
  const d = new Date(new Date(fechaVencimiento).getTime() + HORAS_DE_GRACIA * 3600000)
  return typeof fechaVencimiento === 'string' ? d.toISOString() : d
}

/**
 * El motivo del rechazo, dicho para quien lo lee en la pantalla. Wompi manda a
 * veces una frase («Saldo insuficiente») y a veces un JSON de validación.
 */
export function motivoLegible(texto) {
  let t = String(texto ?? '').trim()
  if (t.startsWith('{') || t.startsWith('[')) {
    try {
      const plano = (v) => (v && typeof v === 'object' ? Object.values(v).flatMap(plano) : [String(v)])
      t = plano(JSON.parse(t)).join('. ')
    } catch { /* se queda como vino */ }
  }
  if (/saldo|fondos|insuficiente/i.test(t)) return 'No había saldo suficiente.'
  if (/no existe la fuente|fuente de pago|revoc|inactiv|cancelad/i.test(t)) {
    return 'El permiso de cobro ya no está activo. Vuelve a guardar tu medio de pago.'
  }
  if (!t || /^(DECLINED|ERROR|VOIDED|rechazado)$/i.test(t)) {
    return 'El pago fue rechazado. Lo más común es que no haya saldo.'
  }
  return `El pago fue rechazado: ${t.slice(0, 140)}`
}

/** Lo que hay que pedir de Organization para `resumenCobro`. */
export const selectResumenCobro = {
  ...selectCobro,
  wompiFuenteRotulo: true,
  cobroFallos: true,
  cobroRefPendiente: true,
  cobroRechazoMotivo: true,
}

/**
 * Lo que las pantallas necesitan saber del cobro automático, dicho igual en el
 * banner, en el inicio, en «Mi plan» y en la pantalla de acceso suspendido.
 * `fechaVencimiento` es la de la suscripción que mira la puerta de acceso.
 */
export function resumenCobro(org, fechaVencimiento) {
  const rechazo = rechazoVigente(org, fechaVencimiento)
  return {
    /* Se le cobra solo y nada ha fallado: calla los avisos. */
    activo: cobroSinRechazo(org, fechaVencimiento),
    conFuente: conCobroAutomatico(org),
    rechazo: rechazo
      ? { motivo: motivoLegible(org.cobroRechazoMotivo), fallos: org.cobroFallos ?? 0 }
      : null,
    /* Hay un cobro mandado del que la pasarela todavía no ha dicho nada. */
    pendiente: Boolean(org?.cobroRefPendiente),
    rotulo: org?.wompiFuenteRotulo ?? null,
    fallos: org?.cobroFallos ?? 0,
  }
}
