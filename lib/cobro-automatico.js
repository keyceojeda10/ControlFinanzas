// lib/cobro-automatico.js — ¿a este negocio se le cobra solo?
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
// Cada pantalla y cada cron preguntaba a su manera. Esta es la única respuesta.

/* Tres rechazos seguidos y se para (lo explica el cron de cobro recurrente). */
export const MAX_FALLOS = 3

/* Horas que se sigue dejando entrar a quien tiene el cobro vivo aunque la
   fecha ya haya pasado. Cubren los tres intentos —uno al día— y la espera del
   webhook. Cortarle el sistema a quien ya dio permiso para cobrarle, mientras
   la pasarela lo intenta, es castigarlo por algo que no depende de él. */
export const HORAS_DE_GRACIA = 72

/* El cron pasa una vez al día. Se cobra lo que vence ANTES de la próxima
   pasada: esperar a que venza es dejarlo hasta 24 h fuera del sistema.
   ⚠ Cobrar unas horas antes NO le quita días: `activarPlanPagado` extiende
   desde la fecha de vencimiento cuando aún no ha llegado. */
export const HORAS_DE_ANTICIPO = 24

/** El filtro de Prisma, sobre Organization. */
export const whereCobroVivo = {
  cobroAutomatico: true,
  wompiFuentePagoId: { not: null },
  cobroFallos: { lt: MAX_FALLOS },
}

/** Los campos que hay que pedir para poder llamar a `cobroVivo`. */
export const selectCobro = {
  cobroAutomatico: true,
  wompiFuentePagoId: true,
  cobroFallos: true,
}

/** ¿Se le va a cobrar solo? Con un `select` sin estos campos devuelve false. */
export function cobroVivo(org) {
  return Boolean(
    org &&
    org.cobroAutomatico === true &&
    org.wompiFuentePagoId != null &&
    (org.cobroFallos ?? 0) < MAX_FALLOS
  )
}

/**
 * La fecha a partir de la cual se corta el acceso. Es la de vencimiento, más la
 * gracia si el cobro está vivo. Devuelve el mismo tipo que recibe (Date o ISO).
 */
export function vencimientoEfectivo(fechaVencimiento, org) {
  if (!fechaVencimiento) return fechaVencimiento
  if (!cobroVivo(org)) return fechaVencimiento
  const d = new Date(new Date(fechaVencimiento).getTime() + HORAS_DE_GRACIA * 3600000)
  return typeof fechaVencimiento === 'string' ? d.toISOString() : d
}
