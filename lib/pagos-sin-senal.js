// lib/pagos-sin-senal.js — lo que comparten el teléfono y el servidor sobre
// un cobro que se registró SIN SEÑAL y sube después.
//
// ══ POR QUÉ EXISTE ══════════════════════════════════════════════════════════
//
// 4 sep 2026, 7:43 pm. Un prestamista registró un abono de $150.000 en la
// puerta del cliente, sin internet. La app lo guardó en el teléfono, le enseñó
// «Pago registrado» en grande y una línea ámbar pequeña, y le dejó mandar el
// recibo por WhatsApp. Al día siguiente el cliente seguía en mora: el pago
// nunca llegó al servidor, y lo único que lo decía era una pastilla de 9px.
// Y si el servidor lo hubiera rechazado una vez —sesión vencida, plan vencido,
// caja cerrada—, la app solo ofrecía «Descartar».
//
// Aquí van las tres reglas que faltaban, PURAS y probadas, para que el
// teléfono, el service worker y el API digan lo mismo:
//
//   1 · el MARCADOR: cada cobro encolado lleva un identificador (la hora en
//       que se guardó) que viaja en la nota. Con él el servidor reconoce el
//       mismo cobro si llega dos veces (un reintento tras un timeout) y NO lo
//       confunde con otro cobro igual de otro día.
//   2 · la FECHA: el cobro se registra con la hora en que se cobró, no con la
//       hora en que hubo señal. Un abono del jueves es plata del jueves.
//   3 · el FALLO: no todo rechazo es definitivo. Sesión cerrada, plan vencido,
//       caja cerrada o «duplicado» se reintentan; un préstamo que ya no existe,
//       no.

/** El texto que se pega a la nota y por el que el servidor reconoce el cobro. */
export function marcadorOffline(offlineId) {
  return `[offline: ${offlineId}]`
}

/** Días hacia atrás que se aceptan como fecha real de un cobro encolado. Más
 *  viejo que esto es casi seguro un reloj mal puesto, y se registra con hoy. */
export const DIAS_MAX_ATRAS = 30

/**
 * La fecha con la que se registra un cobro que subió desde la cola.
 * Devuelve `{ fecha, motivo }`: `motivo` es null cuando se respetó la fecha
 * real, y explica en una frase cuando se usó «ahora».
 */
export function resolverFechaDelPago({ fechaPago, ahora = new Date() } = {}) {
  const hoy = ahora instanceof Date ? ahora : new Date(ahora)
  if (!fechaPago) return { fecha: hoy, motivo: 'sin fecha' }
  const f = new Date(fechaPago)
  if (Number.isNaN(f.getTime())) return { fecha: hoy, motivo: 'fecha inválida' }
  // 5 minutos de margen: relojes de teléfono que van un poco adelantados.
  if (f.getTime() > hoy.getTime() + 5 * 60 * 1000) return { fecha: hoy, motivo: 'fecha en el futuro' }
  if (hoy.getTime() - f.getTime() > DIAS_MAX_ATRAS * 24 * 60 * 60 * 1000) return { fecha: hoy, motivo: `más de ${DIAS_MAX_ATRAS} días atrás` }
  return { fecha: f, motivo: null }
}

/** ¿Un rechazo con este estado HTTP se vuelve a intentar solo? */
export function esFalloReintentable(status) {
  // 401 sesión · 403 plan vencido o caja cerrada · 408 timeout · 409 «duplicado»
  // · 429 demasiadas peticiones. Todos cambian con el tiempo o con un toque
  // de la persona; ninguno significa que el cobro esté mal.
  return [401, 403, 408, 409, 429].includes(Number(status)) || Number(status) >= 500
}

/** Lo que se le dice a la persona cuando un cobro no subió. En su idioma, no
 *  en el del servidor: «HTTP 403» no le dice qué tocar. */
export function explicarFallo({ status, errorMsg } = {}) {
  const s = Number(status)
  const m = String(errorMsg || '').toLowerCase()
  if (s === 401 || /no autorizado/.test(m)) return 'La sesión estaba cerrada cuando intentó subir. Entra de nuevo y reintenta.'
  if (/suscripci|plan/.test(m)) return 'El plan estaba vencido cuando intentó subir. Activa el plan y reintenta.'
  if (/caja/.test(m)) return 'La caja del día estaba cerrada. Reábrela y reintenta.'
  if (s === 409 || /duplicad/.test(m)) return 'El servidor lo tomó por repetido. Reintenta: ahora sube como cobro aparte.'
  if (/inactiv|no encontrado|saldado/.test(m)) return 'El préstamo ya no está activo. Revísalo antes de descartar este cobro.'
  if (/intentos|red|timeout/.test(m) || s >= 500) return 'El servidor no respondió. Reintenta.'
  return errorMsg || 'No se pudo subir. Reintenta.'
}
