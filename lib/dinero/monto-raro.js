// lib/dinero/monto-raro.js — ¿esta cifra parece un dedazo? Sin dependencias.
//
// «Hay muchas pantallas donde un valor muy inferior o muy alto puede descuadrarle
//  todo al usuario» — el dueño, 7 nov 2026, tras un abono previo de $80 por $80.000.
//
// ⚠ NUNCA UN TOPE FIJO. «cobrossalgar» tiene 157 préstamos de $10 a $2.640: escribe
//   en miles sin el modo abreviado, y para ese negocio $80 es normal. Lo raro se
//   mide contra ESTE préstamo: su cuota y lo que este cliente ya ha pagado.
//
// ⚠ PREGUNTA, NO PROHÍBE. Los dos extremos también pasan de verdad: quien abona
//   $5.000 de una cuota de $100.000. Se le pregunta con la respuesta a un toque.
//
// LOS NÚMEROS NO ESTÁN A OJO. Medidos el 7 nov 2026 contra 75.964 cobros que se
// quedaron y 1.165 que alguien anuló (anulado y vuelto a meter en 30 min = error
// comprobado; 71 de ellos con ceros de más o de menos):
//
//                                              cobros bien   anulados
//   < 20 % de la cuota y < mitad de su mínimo      513          79
//   > 10 veces la cuota y > doble de su máximo     228          23
//
// Las dos juntas atrapan 49 de los 71 errores de ceros y preguntan una vez cada 90
// cobros. Con «5 veces» atrapa 55 pero pregunta una vez cada 60: no compensa.
// Lo que queda fuera es un monto que parece normal ($35.000 con cuota de $40.000,
// cuando eran $350.000): ninguna regla de tamaño lo ve.

export const POCO_DE_LA_CUOTA = 0.2
export const MUCHO_DE_LA_CUOTA = 10

/** Solo los cobros de a pie. Abono a capital, interés, recargo, descuento y
 *  liquidación son decisiones aparte, con sus propios topes y sentido. */
export const TIPOS_QUE_SE_PREGUNTAN = ['completo', 'parcial']

/** Lo que manda la pantalla que SÍ sabe preguntar. Sin `preguntarMonto` el servidor
 *  no pregunta: así no se le rechaza nada a la cola sin señal (ese cobro ya se hizo
 *  en la puerta), ni a una pantalla vieja abierta, ni a Lucas.
 *  `respuesta`: 'era_otra' | 'confirmo', cuando ya contestaron. */
export function camposDePregunta(respuesta = null) {
  return respuesta ? { respuestaMontoRaro: respuesta } : { preguntarMonto: true }
}

/** ¿Vale la pena mirar el historial? Para no consultar la base en cada cobro. */
export function fueraDeLaCuota(monto, cuota) {
  const m = Number(monto) || 0
  const c = Number(cuota) || 0
  if (m <= 0 || c <= 0) return false
  return m < c * POCO_DE_LA_CUOTA || m > c * MUCHO_DE_LA_CUOTA
}

/** La cifra que probablemente quiso escribir: la potencia de 10 que más la acerca a
 *  la cuota, si queda en lo normal y cabe en lo que debe. Sin candidata, `null`. */
export function cifraProbable({ monto, cuota, saldo }) {
  const m = Number(monto) || 0
  const c = Number(cuota) || 0
  if (m <= 0 || c <= 0) return null
  const candidatas = m < c
    ? [m * 10, m * 100, m * 1000]
    : [m / 10, m / 100, m / 1000].filter(Number.isInteger)
  /* Menos de $1.000 con una cuota grande es casi siempre que faltaron los miles:
     $30 con cuota de $175.000 eran $30.000, aunque sea el 17 % de la cuota. */
  const piso = (x) => (m < 1000 && x === m * 1000 ? c * 0.05 : c * POCO_DE_LA_CUOTA)
  const sirven = candidatas.filter((x) => x >= piso(x) && x <= c * 5 && (saldo == null || x <= saldo))
  if (!sirven.length) return null
  if (m < 1000 && sirven.includes(m * 1000)) return m * 1000
  const lejos = (x) => Math.abs(Math.log(x / c))
  return sirven.reduce((mejor, x) => (lejos(x) < lejos(mejor) ? x : mejor))
}

/**
 * ¿Hay que preguntar por este cobro?
 * @param {object} a
 * @param {number} a.monto
 * @param {number} a.cuota
 * @param {number} a.saldo    lo que debe antes de este pago
 * @param {number|null} a.minimo  su pago más bajo hasta hoy (null si es el primero)
 * @param {number|null} a.maximo  su pago más alto hasta hoy
 * @returns {null | { tipo: 'poco'|'mucho', monto: number, cuota: number, sugerido: number|null }}
 */
export function cobroRaro({ monto, cuota, saldo, minimo = null, maximo = null }) {
  const m = Number(monto) || 0
  const c = Number(cuota) || 0
  if (!fueraDeLaCuota(m, c)) return null
  // Salda el préstamo: ni poco ni mucho, es exactamente lo que debe (o lo excede y
  // de eso ya se encarga el tope). La última cuota suele ser la más pequeña.
  if (saldo != null && m >= Number(saldo) - 1) return null

  const tipo = m < c * POCO_DE_LA_CUOTA ? 'poco' : 'mucho'
  // Este cliente ya ha pagado así: es su costumbre, no un dedazo.
  if (tipo === 'poco' && minimo != null && m >= Number(minimo) * 0.5) return null
  if (tipo === 'mucho' && maximo != null && m <= Number(maximo) * 2) return null

  return { tipo, monto: m, cuota: c, sugerido: cifraProbable({ monto: m, cuota: c, saldo }) }
}

/**
 * ¿Este «ya había pagado» parece escrito en miles? Abono de $80 en un préstamo de
 * $500.000. Se exige que el préstamo no sea también de cifras pequeñas (los negocios
 * que escriben todo en miles) y que el abono ×1000 quepa en lo que se debe.
 * Medido: 12 de 1.772 abonos previos, y entre ellos varios idénticos a la cuota.
 * @returns {null | { sugerido: number }}
 */
export function abonoPrevioRaro({ abono, montoPrestado, totalAPagar = null }) {
  const a = Number(abono) || 0
  const monto = Number(montoPrestado) || 0
  if (a < 1 || a >= 1000 || monto < 10000) return null
  const sugerido = a * 1000
  // Sin el total a mano (la fila de una foto), lo prestado más su interés no suele
  // pasar del doble.
  if (sugerido > (Number(totalAPagar) || monto * 2)) return null
  return { sugerido }
}

/** ¿Falta que respondan por este abono? `confirmado` es la cifra que ya dijeron que
 *  sí era: si después cambia el abono, se vuelve a preguntar. */
export function abonoSinResolver({ abono, montoPrestado, totalAPagar, confirmado = null }) {
  if (!abonoPrevioRaro({ abono, montoPrestado, totalAPagar })) return false
  return Number(confirmado) !== Number(abono)
}
