/**
 * EL INTERÉS QUE COMPRA UN PERÍODO — la cifra que el cobrador no tenía.
 *
 * En la hoja de cobro, la pestaña «Interés» de un préstamo clásico abre con el
 * campo VACÍO y sin un solo atajo. Es a propósito —heredaba la cuota y un toque
 * de más subía la deuda $175.000, ver [[feature_interes_compra_tiempo]]— pero
 * deja al cobrador teclear de memoria en la puerta del cliente la única cifra
 * que ahí significa algo:
 *
 *   «Tengo clientes que en la quincena no me pueden dar la cuota, pero me dan
 *    el interés: por ese interés les cobro 50 mil.»
 *      — un prestamista, 16 ago 2026
 *
 * Esos $50.000 son $500.000 al 20% mensual, partido en dos quincenas. El
 * sistema sabe la tasa, la frecuencia y el capital; lo único que no hacía era
 * decirlo.
 *
 * ⚠ ES LA ÚNICA FUNCIÓN QUE PUEDE RESPONDER A ESTO, como `entraAlFajo()` es la
 *   única que dice si un cobro va al fajo. Un `capital * tasa / 2` suelto en una
 *   pantalla es de donde salen las dos cifras distintas.
 *
 * ── POR QUÉ SOLO DOS MODOS ───────────────────────────────────────────────────
 * El mismo % significa cosas distintas según `modoInteres` —hasta 6,6× entre el
 * más caro y el más barato— así que no hay una fórmula que valga para todos:
 *
 *   · `fijo`         → la tasa es MENSUAL, en bloques de frecuencia. Un período
 *                      es 1/PERIODOS_POR_MES de mes. Es el 69% de la cartera.
 *   · `proporcional` → la tasa es MENSUAL prorrateada por DÍAS (monto × tasa ×
 *                      días/30). Un período son sus días naturales. Legacy.
 *   · `unico`        → la tasa es PLANA, del préstamo entero. Partirla por
 *                      períodos sería inventarse una tasa mensual que nadie
 *                      pactó: cuanto más largo el plazo, más barato saldría el
 *                      mes, y el prestamista cobraría de menos sin enterarse.
 *   · `manual`       → no hay tasa: la cuota la escribe el prestamista.
 *   · con tabla      → el interés ya está pactado fila por fila y tiene su tope
 *                      en `calcularInteresesPendientes`. Aquí no se pregunta.
 *
 * ── Y POR QUÉ EL CAPITAL VIVO ────────────────────────────────────────────────
 * Se cobra interés sobre lo que el cliente TIENE, no sobre lo que un día se le
 * entregó: si abonó a capital, el período siguiente genera menos. Es el mismo
 * criterio que `periodoEnCursoAbierto` en `lib/calculos.js`.
 *
 * `capitalRestante` lo calcula el servidor con los pagos cargados
 * (`app/api/prestamos/[id]/route.js`). Si no llegó, esta función NO lo
 * sustituye por `montoPrestado`: ese número es siempre MAYOR, y equivocarse
 * hacia arriba en la pantalla del cobro es cobrarle de más a alguien que ya
 * entregó la plata. Sin el dato, no hay cifra.
 *
 * Medido contra el espejo (13 sep 2026), en préstamos «fijo» sin recargos ni
 * abonos: la cifra coincide con el interés que el propio préstamo tiene
 * pactado, al peso salvo el redondeo de la cuota a múltiplos de 100.
 *
 *   quincenal 20% · $500.000 → $50.000  (pactado $50.067)
 *   semanal   20% · $600.000 → $30.000  (pactado $30.033)
 *   mensual    3% · $700.000 → $21.000  (pactado $21.022)
 *   diario    20% · $450.000 →  $3.000  (pactado  $3.050)
 */

import { PERIODOS_POR_MES } from '@/lib/calculos'
import { elInteresSubeLaDeuda } from './modos'

/** Cuántos días dura un período de cada frecuencia, para el modo legacy. */
const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

/** Cómo se llama ese período cuando hay que escribirlo en la pantalla. */
const NOMBRE_DEL_PERIODO = {
  diario: 'un día',
  semanal: 'una semana',
  quincenal: 'una quincena',
  mensual: 'un mes',
}

/**
 * @returns {{ monto: number, periodo: string, etiqueta: string } | null}
 *   `null` cuando el préstamo no admite la pregunta o falta el dato. Nunca una
 *   cifra aproximada: quien la reciba la va a cobrar.
 */
export function interesQueCompraUnPeriodo(prestamo) {
  if (!prestamo) return null
  // Con tabla de amortización el interés ya está pactado y esta pregunta no
  // aplica. `elInteresSubeLaDeuda` revienta si el préstamo llegó sin el
  // `include`, que es justo lo que tiene que pasar: adivinar movería plata.
  if (!elInteresSubeLaDeuda(prestamo)) return null

  const modo = prestamo.modoInteres || 'fijo'
  if (modo !== 'fijo' && modo !== 'proporcional') return null

  const tasa = Number(prestamo.tasaInteres)
  if (!Number.isFinite(tasa) || tasa <= 0) return null

  const frecuencia = prestamo.frecuencia || 'diario'
  const periodo = NOMBRE_DEL_PERIODO[frecuencia]
  if (!periodo) return null

  const capital = Number(prestamo.capitalRestante)
  if (!Number.isFinite(capital) || capital <= 0) return null

  const mesesDelPeriodo = modo === 'proporcional'
    ? (DIAS_POR_PERIODO[frecuencia] ?? 0) / 30
    : 1 / (PERIODOS_POR_MES[frecuencia] ?? 0)
  if (!Number.isFinite(mesesDelPeriodo) || mesesDelPeriodo <= 0) return null

  const monto = Math.round(capital * (tasa / 100) * mesesDelPeriodo)
  // Un interés que redondea a cero no es un atajo, es un botón que no hace
  // nada: pasa en préstamos diarios de capital pequeño.
  if (monto <= 0) return null

  return { monto, periodo, etiqueta: `Interés de ${periodo}` }
}
