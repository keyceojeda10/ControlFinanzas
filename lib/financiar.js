/* FINANCIAR EL SALDO — «financiar la cartulina 30 días más».
 *
 * PRESTA MIL (1.066 préstamos activos), 21 sep 2026, en un vídeo:
 *
 *   «El cliente le presté una cartulina de 2 millones. En el mes solamente
 *    termina de pagarme uno; me queda debiendo un millón. Como no tiene cómo
 *    pagarlo, me dice: fináncieme la cartulina 30 días más. Le cobro los
 *    intereses de un millón, que serían 200. Como no tengo dónde colocarlos, los
 *    coloco donde dice recargo […] pero los días en mora siguen quedando los
 *    mismos. Yo necesito que arranque en cero, porque acabé de llegar a un
 *    acuerdo con el cliente, y la fecha desde el día que financio la cartulina,
 *    y la fecha final cuando se cumplan los 30 días.»
 *
 * Medido en producción ese día: 161 de sus préstamos activos llevaban recargos
 * y ya habían pasado su fecha final — cartulinas financiadas a mano que seguían
 * sumando mora. El del vídeo iba por su TERCER recargo y 79 días de «atraso».
 *
 * Qué es, por dentro: LA MISMA RENOVACIÓN, sin entregar plata. Se cierra el
 * préstamo viejo por lo que debe, se abre uno nuevo desde hoy con esa deuda más
 * el interés que se pactó, y la mora empieza en cero porque el préstamo es
 * nuevo. No se toca la caja: no sale un peso. Queda enlazado al anterior, así
 * que se puede deshacer como cualquier renovación.
 *
 * Aquí solo va la cuenta —pura, para probarla—. La usan la hoja (para enseñar
 * lo que va a quedar) y el servidor (para guardarlo): la misma función, así la
 * pantalla no puede prometer una cifra que el servidor no registra.
 */
import { calcularPrestamo } from '@/lib/calculos'

/* El préstamo nuevo va SIEMPRE a cuota fija: total = deuda + interés, repartido
   en el plazo. Es lo que el prestamista pactó en la puerta —«le cobro 200»—, y
   en ese modo la tasa es el porcentaje total sobre lo prestado, que es la única
   semántica en la que un interés en pesos se traduce sin adivinar. */
export const MODO_FINANCIAR = 'fijo'

export const DIAS_POR_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

/** El interés de un porcentaje sobre la deuda, en pesos enteros. */
export function interesPorPorcentaje(deuda, porcentaje) {
  const d = Number(deuda) || 0
  const p = Number(porcentaje) || 0
  if (d <= 0 || p <= 0) return 0
  return Math.round((d * p) / 100)
}

/** La tasa (total, en %) que reproduce ese interés sobre esa deuda en modo fijo. */
export function tasaDeFinanciar(deuda, interes) {
  const d = Number(deuda) || 0
  const i = Math.max(0, Number(interes) || 0)
  if (d <= 0) return 0
  return (i / d) * 100
}

/**
 * Lo que va a quedar. `calcularPrestamo` redondea la cuota a la unidad del país,
 * así que el total puede pasar unos pesos del «deuda + interés» exacto: por eso
 * se enseña el total que de verdad se guarda, no la suma a ojo.
 *
 * @param {object} p
 * @param {number} p.deuda       lo que debe hoy (lo decide el servidor al guardar)
 * @param {number} p.interes     lo que se le cobra por financiar, en pesos
 * @param {number} p.periodos    cuántas cuotas
 * @param {string} p.frecuencia  diario | semanal | quincenal | mensual
 * @param {string} p.fechaInicio YYYY-MM-DD
 */
export function vistaFinanciar({ deuda, interes, periodos, frecuencia = 'diario', fechaInicio }) {
  const d = Math.round(Number(deuda) || 0)
  const n = Math.max(1, Math.round(Number(periodos) || 0))
  if (d <= 0) return null
  const diasPlazo = n * (DIAS_POR_PERIODO[frecuencia] ?? 1)
  const tasa = tasaDeFinanciar(d, interes)
  const calc = calcularPrestamo({
    montoPrestado: d, tasaInteres: tasa, diasPlazo, frecuencia, modoInteres: MODO_FINANCIAR, fechaInicio,
  })
  return {
    deuda: d,
    interes: Math.round(Number(interes) || 0),
    tasa,
    diasPlazo,
    periodos: calc.numPeriodos,
    total: calc.totalAPagar,
    cuota: calc.cuotaDiaria,
    fechaFin: calc.fechaFin,
  }
}
