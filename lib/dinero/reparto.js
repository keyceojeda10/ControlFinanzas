// ═══════════════════════════════════════════════════════════════════════════
// CUÁNTO DE LO COBRADO ES GANANCIA Y CUÁNTO ES TU PLATA VOLVIENDO
//
// ── LA PREGUNTA ───────────────────────────────────────────────────────────
//
// Prestaste $500.000 y vas a cobrar $600.000. El cliente te ha pagado
// $300.000. ¿Cuánto de eso era interés y cuánto era tu capital regresando?
//
// De la respuesta salen «capital en la calle» —la cifra con la que decides si
// puedes prestar más—, la ganancia del mes, el ROI y el reparto a los socios.
//
// ── LAS DOS CONVENCIONES, Y POR QUÉ HAY QUE ELEGIR ────────────────────────
//
//   CASCADA       primero se cobra TODO el interés. Hasta que no entren los
//                 $100.000, el capital no baja un peso. → quedan $300.000
//   PROPORCIONAL  cada peso lleva su parte: 5/6 capital, 1/6 interés.
//                 → quedan $250.000
//
// Las dos son defendibles y las dos existían en el código a la vez, bajo el
// MISMO rótulo. Medido sobre la cartera real el 1 ago 2026:
//
//     capital en la calle, proporcional ....  $3.306.304.236
//     capital en la calle, cascada .........  $3.570.918.455   (8,0% más)
//     Σ montoPrestado, la fórmula vieja ....  $4.014.989.950  (21,4% más)
//
// **Decidido: PROPORCIONAL para reportar.** Es lo que dice la tabla de
// amortización que la app ya imprime y el cliente ya firmó; hace que
// «capital pendiente + lo que falta por ganar = cartera» cuadre en todos los
// modos; y no cuenta como ganada plata que todavía no se ganó.
//
// Para LIQUIDAR —qué debe si cierra hoy— el prestamista sigue eligiendo entre
// las dos, que es lo que `calcularLiquidacionAnticipada` ya hace bien
// devolviendo las dos modalidades. Son dos preguntas distintas.
//
// ── LA TABLA MANDA SOBRE LAS DOS ──────────────────────────────────────────
//
// Cuando el préstamo TIENE tabla de amortización, ninguna convención hace
// falta: la tabla dice exactamente cuánto interés lleva cada cuota. En un
// Decreciente el interés del primer periodo se calcula sobre el saldo completo
// y es mucho mayor que el del último, así que repartir proporcionalmente lo
// subestima. Un cliente lo reportó con números: la tabla decía $7.742 de
// interés en el mes 1 y analíticas registraba $6.896.
//
// Medido sobre los 295 préstamos con tabla: el proporcional subestimaba la
// ganancia en $7.690.180, un 27,3%.
//
// ── POR QUÉ ESTO ES UN MÓDULO ─────────────────────────────────────────────
//
// Porque el reparto estaba escrito A MANO en NUEVE sitios: cuatro en SQL y
// cinco en JavaScript. Cuatro de ellos aplicaban la corrección por tabla y
// cinco no, así que la misma pregunta daba respuestas distintas en la misma
// pantalla. `repartoSql()` existe para que el sitio que calcula en SQL use LA
// MISMA definición: una fuente, dos lenguajes.
// ═══════════════════════════════════════════════════════════════════════════

import {
  tieneTablaAmortizacion,
  interesAcumuladoTabla,
} from '../calculos.js'

export const METODO = Object.freeze({
  TABLA: 'tabla',
  PROPORCIONAL: 'proporcional',
})

const redondo = (n) => Math.round(Number(n) || 0)

/** Con qué método se reparte este préstamo. La tabla manda si la hay. */
export function metodoDe(prestamo) {
  return tieneTablaAmortizacion(prestamo) ? METODO.TABLA : METODO.PROPORCIONAL
}

/**
 * De TODO lo pagado hasta hoy, cuánto fue interés y cuánto capital devuelto.
 *
 * Los abonos explícitos a capital van aparte: el prestamista dijo «esto es
 * capital» y se respeta, no entra al reparto.
 */
export function repartirPagado(prestamo) {
  if (!prestamo) return { capital: 0, interes: 0, metodo: METODO.PROPORCIONAL }

  const monto = Number(prestamo.montoPrestado) || 0
  const total = Number(prestamo.totalAPagar) || 0
  const pagadoTotal = Number(prestamo.totalPagado) || 0

  // Los abonos a capital bajan capital directo, sin repartirse.
  const abonos = Math.min(
    (prestamo.pagos ?? [])
      .filter((p) => p.tipo === 'capital')
      .reduce((a, p) => a + (Number(p.montoPagado) || 0), 0),
    monto,
  )
  const aRepartir = Math.max(0, pagadoTotal - abonos)

  if (tieneTablaAmortizacion(prestamo)) {
    const interes = interesAcumuladoTabla(prestamo.cuotasAmortizacion, aRepartir)
    return {
      capital: redondo(aRepartir - interes + abonos),
      interes: redondo(interes),
      metodo: METODO.TABLA,
    }
  }

  if (total <= 0) {
    return { capital: redondo(aRepartir + abonos), interes: 0, metodo: METODO.PROPORCIONAL }
  }

  // Cada peso lleva su parte.
  //
  // ⚠ SE REDONDEA UNA SOLA VEZ Y LA OTRA SALE POR RESTA.
  //
  // Redondear las dos por separado INVENTA PESOS: con $12.345 pagados de un
  // 500.000/600.000, el capital da 10.287,5 y el interes 2.057,5; redondeando
  // los dos hacia arriba salen 10.288 + 2.058 = 12.346. Un peso de la nada, en
  // una cifra que se suma sobre miles de pagos.
  //
  // Lo cazo la prueba «capital + interés es exactamente lo pagado».
  const capital = redondo(aRepartir * (monto / total))
  return {
    capital: capital + abonos,
    interes: aRepartir - capital,
    metodo: METODO.PROPORCIONAL,
  }
}

/**
 * TU PLATA QUE SIGUE EN LA CALLE. Lo prestado menos lo que ya volvió.
 *
 * Nunca por encima de lo que falta cobrar: si un préstamo lleva recargos, el
 * capital vivo no puede pasarse del saldo pendiente.
 */
export function capitalEnCalle(prestamo) {
  if (!prestamo) return 0
  const monto = Number(prestamo.montoPrestado) || 0
  const { capital } = repartirPagado(prestamo)
  const restante = Math.max(0, monto - capital)

  const saldo = Math.max(0, (Number(prestamo.totalAPagar) || 0) - (Number(prestamo.totalPagado) || 0))
  return redondo(Math.min(restante, saldo || restante))
}

/** Lo que ya ganaste de este préstamo: el interés efectivamente cobrado. */
export function interesGanado(prestamo) {
  return repartirPagado(prestamo).interes
}

/**
 * LO QUE FALTA POR GANAR si el cliente termina de pagar.
 *
 * Con esto se cumple la identidad que la ficha de ruta ya usa y que hasta
 * ahora solo cuadraba de casualidad:
 *
 *     capital en la calle + por ganar = saldo pendiente
 */
export function porGanar(prestamo) {
  if (!prestamo) return 0
  const saldo = Math.max(0, (Number(prestamo.totalAPagar) || 0) - (Number(prestamo.totalPagado) || 0))
  return redondo(Math.max(0, saldo - capitalEnCalle(prestamo)))
}

/**
 * El MISMO reparto, en SQL, para el sitio que agrega en la base.
 *
 * Analíticas, el PDF y el reparto a socios calculan con `SUM(...)` sobre miles
 * de filas y traerlas a JavaScript sería absurdo. Pero tener la fórmula escrita
 * dos veces es como empezó todo esto, así que sale de aquí.
 *
 * ⚠ Es el reparto PROPORCIONAL puro. Los préstamos con tabla necesitan la
 * corrección aparte —el SQL no puede recorrer las cuotas— y por eso los
 * llamadores le suman `correccionTablaPorMes`. Que la corrección se aplicara en
 * unos sitios sí y en otros no es lo que hacía que la misma pantalla enseñara
 * dos «ganancia del mes» distintas.
 *
 * @param pago      alias de la tabla Pago
 * @param prestamo  alias de la tabla Prestamo
 */
export function repartoSql({ pago = 'p', prestamo = 'pr', monto = 'montoPagado' } = {}) {
  const frac = `(${prestamo}.totalAPagar - ${prestamo}.montoPrestado) / ${prestamo}.totalAPagar`
  return {
    interes: `CASE WHEN ${prestamo}.totalAPagar > 0 THEN ${pago}.${monto} * ${frac} ELSE 0 END`,
    capital: `CASE WHEN ${prestamo}.totalAPagar > 0 THEN ${pago}.${monto} * (${prestamo}.montoPrestado / ${prestamo}.totalAPagar) ELSE 0 END`,
  }
}
