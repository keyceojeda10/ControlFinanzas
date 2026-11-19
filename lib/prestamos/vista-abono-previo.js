// lib/prestamos/vista-abono-previo.js — lo que el resumen de «Nuevo préstamo»
// dice de un préstamo que ya venía del cuaderno (18 nov 2026).
//
// Inducción del 18 nov: el prestamista marca «Ya había pagado algo antes», pone
// $840.000, y el resumen sigue diciendo «Total a pagar $1.260.000» sin una
// palabra del abono, ni de cuándo le toca el próximo cobro, ni de si queda al
// día. El dueño: «en el resumen ellos pueden darse cuenta: no, este cliente no
// me paga el 17 sino el 18, algo hice mal».
//
// No hay cuenta nueva aquí. Se arma el préstamo COMO LO VA A GUARDAR el
// servidor —el abono previo es un pago «completo» fechado el día de inicio a las
// 05:00Z (app/api/prestamos/route.js, `partesDelAbono`)— y se le pregunta a las
// mismas funciones que leen la ficha después: `calcularProximoCobro` y
// `calcularDiasMora`. Así lo que promete el resumen es lo que la ficha dirá.
//
// Los préstamos con tabla (decreciente, globo, dinámico, sobre saldo) y el abierto se dejan sin fecha:
// su próximo cobro depende de la tabla o del interés devengado, que el
// formulario todavía no tiene. Para ellos solo sale lo abonado y lo que queda.

import { calcularProximoCobro, calcularDiasMora } from '@/lib/calculos'
import { NOTA_ABONO_PREVIO_MANUAL } from '@/lib/dinero/abono-previo'

// Los mismos de `tieneTablaAmortizacion` (lib/calculos.js).
const MODOS_CON_TABLA = ['lineal', 'solo_interes', 'lineal_dinamico', 'saldo']

/**
 * @returns {null | { abonado, queda, proximo: Date|null, diasMora: number|null, alDia: boolean|null }}
 */
export function vistaAbonoPrevio({
  abonado, totalAPagar, cuotaDiaria, fechaInicio, frecuencia, modoInteres,
  montoPrestado, tasaInteres, diasPlazo, sinPlazo = false,
  diaCobroSemana = null, diaCobroMes = null, diaCobroMes2 = null, primerCobro = null,
  diasExcluidos = [], festivos = [], ahora = Date.now(),
} = {}) {
  const ab = Math.max(0, Math.round(Number(abonado) || 0))
  const total = Math.round(Number(totalAPagar) || 0)
  if (!(ab > 0) || !(total > 0)) return null
  const queda = Math.max(0, total - ab)

  const sinFecha = sinPlazo || MODOS_CON_TABLA.includes(modoInteres) || !fechaInicio || !(Number(cuotaDiaria) > 0)
  if (sinFecha || queda === 0) return { abonado: ab, queda, proximo: null, diasMora: null, alDia: queda === 0 ? true : null }

  const inicio = `${String(fechaInicio).slice(0, 10)}T05:00:00.000Z`
  const prestamo = {
    estado: 'activo', fechaInicio: inicio, frecuencia, modoInteres,
    montoPrestado: Number(montoPrestado) || 0, tasaInteres: Number(tasaInteres) || 0,
    diasPlazo: Number(diasPlazo) || 0, cuotaDiaria: Number(cuotaDiaria), totalAPagar: total,
    saldoPendiente: queda, sinPlazo: false,
    diaCobroSemana, diaCobroMes, diaCobroMes2, primerCobro,
    pagos: [{ tipo: 'completo', montoPagado: ab, fechaPago: inicio, nota: NOTA_ABONO_PREVIO_MANUAL }],
    cuotasAmortizacion: [],
  }
  let proximo = null
  let diasMora = null
  try { proximo = calcularProximoCobro(prestamo, diasExcluidos, festivos, ahora) } catch { proximo = null }
  try { diasMora = calcularDiasMora(prestamo, diasExcluidos, festivos, ahora) } catch { diasMora = null }
  return { abonado: ab, queda, proximo, diasMora, alDia: diasMora == null ? null : diasMora === 0 }
}
