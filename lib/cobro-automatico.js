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

// ══ INSISTIR COMO NETFLIX, Y SIN HACER RUIDO (13 nov 2026) ═════════════════
//
// Medido del 13 sep al 13 nov: 23 negocios con Nequi guardado, 5 con rechazos
// «No tienes suficiente plata», y los 5 acabaron pagando… casi todos tocando
// ellos «Reintentar» DE NOCHE (23:27, 21:42, 01:20, 02:50, 05:15), después de
// que el cron les cobrara a las 08:00 con el Nequi vacío. E.P llegó a los tres
// rechazos, el cron se rindió, y pagó solo porque él tocó el botón.
//
// El dueño:
//
//   «Netflix te insiste el cobro si tú tienes un pago automático autorizado
//    hasta que te cobre»
//   «avisar por WhatsApp del rechazo no me gustaría […] uno se pone en aviso y
//    pues obviamente va rápidamente a cancelar la tarjeta»
//   «a la 1 de la tarde sería un momento muy […] visual para la gente […]
//    puede cobrarse en la noche […] que no sea tan alarmante ni obvio»
//
// Y al ver la primera versión, que lo pasaba TODO a la noche:
//
//   «mantener el cobro que se estaba haciendo normal, que es el primero […] y
//    los reintentos sí a las 10 de la noche […] Si a las 8 de la mañana ese
//    mismo día no se pudo cobrar, reintentar a las 10 y así sucesivamente»
//
// Por eso hay DOS pasadas del cron (`quePasaEnLaPasada`):
//   · la de la MAÑANA (08:00 Colombia, 13:00 UTC), como siempre: el cobro
//     normal del periodo. Si el periodo ya tiene un rechazo, no lo toca.
//   · la de la NOCHE (22:00 Colombia, 03:00 UTC, `?pasada=noche`): solo los
//     reintentos, la misma noche del rechazo y después las de
//     `NOCHES_DE_REINTENTO` y las de quincena, hasta `DIAS_DE_REINTENTO`.
// Mientras tanto no sale ningún aviso (`whereReintentandoCobro`). Lo único que
// el cliente ve es lo de siempre: al vencer sin pagar, se cierra el acceso.

/* Tope duro de rechazos por periodo: el cobro de la mañana, dos noches antes
   de vencer, las ocho del calendario y hasta cinco de quincena caben justos.
   Es una red por si el calendario cambia, no la regla. */
export const MAX_FALLOS = 16

/* Días después del vencimiento en que se sigue intentando. Pasados, el
   negocio sale del cobro y entra en los avisos normales de quien se fue. */
export const DIAS_DE_REINTENTO = 15

/* Noches tras el vencimiento (0 = la misma noche) en que se reintenta: tres
   seguidas y luego espaciadas. Muchos rechazos seguidos ensucian la reputación
   del comercio con el banco. */
export const NOCHES_DE_REINTENTO = [0, 1, 2, 4, 6, 9, 12, 15]

const DIA = 86400000
/* Wompi solo cobra en Colombia: el calendario es el de Bogotá (−5 h). */
const OFFSET_BOGOTA = -5 * 3600000

/** ¿Es noche de quincena en Bogotá? El 15, el 16, el 30, el último del mes y
 *  el 1: los días en que a la gente le entra la plata. */
export function esNocheDeQuincena(ahora = new Date()) {
  const d = new Date(new Date(ahora).getTime() + OFFSET_BOGOTA)
  const dia = d.getUTCDate()
  const ultimo = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate()
  return dia === 1 || dia === 15 || dia === 16 || dia === 30 || dia === ultimo
}

/**
 * ¿Toca reintentar esta noche? Antes de vencer, todas las noches de la ventana
 * de anticipo; después, las de `NOCHES_DE_REINTENTO` y las de quincena, hasta
 * `DIAS_DE_REINTENTO`.
 */
export function tocaIntentar(fechaVencimiento, ahora = new Date()) {
  const vence = new Date(fechaVencimiento).getTime()
  const t = new Date(ahora).getTime()
  if (t < vence) return t >= vence - HORAS_DE_ANTICIPO * 3600000
  const noche = Math.floor((t - vence) / DIA)
  if (noche > DIAS_DE_REINTENTO) return false
  return NOCHES_DE_REINTENTO.includes(noche) || esNocheDeQuincena(ahora)
}

/**
 * Qué hace una pasada del cron con un negocio que está en la ventana.
 *   'cobrar'     → se manda el cobro.
 *   'no-es-suyo' → lo lleva la otra pasada: la mañana el cobro normal, la
 *                  noche los reintentos de un rechazo de ESTE periodo.
 *   'agotado'    → llegó a `MAX_FALLOS`.
 *   'hoy-no'     → reintento, pero esta noche no está en el calendario.
 *
 * @param {{ pasada: 'manana'|'noche', vigente: boolean, fallos?: number,
 *           vence: Date|string, ahora?: Date }} p
 *   `vigente` = `rechazoVigente(org, vence)`.
 */
export function quePasaEnLaPasada({ pasada, vigente, fallos = 0, vence, ahora = new Date() }) {
  if (pasada !== 'noche') return vigente ? 'no-es-suyo' : 'cobrar'
  if (!vigente) return 'no-es-suyo'
  if ((fallos ?? 0) >= MAX_FALLOS) return 'agotado'
  return tocaIntentar(vence, ahora) ? 'cobrar' : 'hoy-no'
}

/* ⚠ EL COBRO SALE ANTES DE QUE VENZA. El cron pasa una vez al día, así que con
   48 h el primer intento cae entre 24 y 48 h antes del vencimiento y queda una
   pasada más antes de la hora de corte. Si el primero se rechaza por falta de
   saldo, hay un día entero para recargar sin perder ni una hora de acceso.
   Cobrar antes NO le quita días: `activarPlanPagado` extiende desde la fecha de
   vencimiento cuando aún no ha llegado. */
export const HORAS_DE_ANTICIPO = 48

/* La ventana del cron después de vencer, en horas: los días de reintento más
   uno, para que la noche `DIAS_DE_REINTENTO` caiga dentro aunque el plan venza
   de madrugada. Quién se cobra dentro de ella lo decide `tocaIntentar`. */
export const HORAS_DE_REINTENTO = (DIAS_DE_REINTENTO + 1) * 24

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

/** Filtro de Prisma, sobre Organization: medio guardado y cobro encendido,
 *  haya fallado o no. */
export const whereConCobroAutomatico = {
  cobroAutomatico: true,
  wompiFuentePagoId: { not: null },
}

/**
 * Filtro de Prisma, sobre Organization: el cron todavía le está cobrando
 * (medio guardado, y un plan pagado que vence en el futuro o venció hace
 * menos de `DIAS_DE_REINTENTO`). Los avisos de «tu plan vence», «se venció» y
 * los de recuperación lo dejan fuera AUNQUE HAYA RECHAZO: avisar del rechazo
 * es ponerlo en guardia para quitar el medio. Ver arriba, 13 nov 2026.
 */
export function whereReintentandoCobro(ahora = new Date()) {
  return {
    ...whereConCobroAutomatico,
    suscripciones: {
      some: {
        montoCOP: { gt: 0 },
        fechaVencimiento: { gte: new Date(new Date(ahora).getTime() - DIAS_DE_REINTENTO * DIA) },
      },
    },
  }
}

/** Lo mismo que `whereReintentandoCobro`, para una suscripción ya leída. */
export function reintentandoCobro(org, fechaVencimiento, ahora = new Date()) {
  if (!conCobroAutomatico(org) || !fechaVencimiento) return false
  return new Date(fechaVencimiento).getTime() >= new Date(ahora).getTime() - DIAS_DE_REINTENTO * DIA
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
  /* Con su punto: las tres pantallas siguen con otra frase («Si no se paga…»)
     y sin él se leía «rechazada (Sandbox) Si no se paga» (27 oct 2026). */
  return `El pago fue rechazado: ${t.slice(0, 140).replace(/[\s.]+$/, '')}.`
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
