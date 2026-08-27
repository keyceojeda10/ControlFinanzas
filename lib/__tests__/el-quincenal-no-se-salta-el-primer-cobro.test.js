/* El quincenal con días del mes tenía DOS calendarios y no coincidían.
 *
 * ══ EL CASO, CONTADO POR EL PRESTAMISTA ═══════════════════════════════════
 *
 * Presta $800.000 el 10 de agosto, quincenal, cobrando el 16 y el 31. Cuatro
 * cuotas de $280.000. El cliente no paga la del 16 y queda en mora. Cuando por
 * fin la paga, el comprobante le dice «próximo cobro: miércoles 16 de sept».
 *
 *   «Si el cliente hace el abono a mora, que sería el pago que correspondería
 *    al 16 de agosto, la cuota del 31 no la cobra. Cuando está pagando es la
 *    anterior y la del 31 la anula.»
 *
 * No la anulaba: NUNCA la había tenido. El calendario entero iba corrido un
 * cobro porque `calcularProximoCobro`, para los préstamos sin tabla, calculaba
 * `fechaInicio + N × 15 días` y luego empujaba al día de cobro — así que el 16
 * de agosto, que cae a solo 6 días de la entrega, no existía:
 *
 *   lo pactado     16 ago → 31 ago → 16 sep → 30 sep
 *   lo que decía   31 ago → 16 sep → 30 sep → 16 oct
 *
 * MEDIDO EN PRODUCCIÓN el 27 ago 2026: de los 93 quincenales vivos sin tabla y
 * sin fecha puesta a mano, 69 en 8 negocios iban 15 o 16 días tarde. */
import { describe, it, expect } from 'vitest'
import { calcularPrestamo, calcularProximoCobro } from '@/lib/calculos'
import { fechaDePeriodo } from '@/lib/dinero/calendario'

const dia = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null)

/* El préstamo del cliente, tal cual. `calcularPrestamo` da la cuota y el total
   —$280.000 y $1.120.000, los mismos de la captura— así que si alguien cambia
   el cálculo, esta prueba deja de describir su caso y hay que mirarla. */
const armar = (pagadas) => {
  const calc = calcularPrestamo({
    montoPrestado: 800000, tasaInteres: 20, diasPlazo: 60,
    fechaInicio: '2026-08-10', frecuencia: 'quincenal', modoInteres: 'fijo',
    diaCobroMes: 16, diaCobroMes2: 31,
  })
  return {
    ...calc,
    montoPrestado: 800000,
    estado: 'activo',
    fechaInicio: new Date('2026-08-10T05:00:00.000Z'),
    diaCobroMes: 16, diaCobroMes2: 31,
    pagos: [],
    totalPagado: pagadas * 280000,
  }
}

describe('el quincenal con días del mes no se salta el primer cobro', () => {
  it('el préstamo es el de la captura: 4 cuotas de $280.000, total $1.120.000', () => {
    const p = armar(0)
    expect(p.cuotaDiaria).toBe(280000)
    expect(p.totalAPagar).toBe(1120000)
    expect(p.numPeriodos).toBe(4)
    // Modo fijo NO genera tabla, y por eso caía en la rama del calendario propio.
    expect(p.tablaAmortizacion).toBeUndefined()
  })

  it('sin pagar nada, el primer cobro es el 16 de agosto', () => {
    // Antes decía 31 de agosto: se saltaba la primera cuota entera.
    expect(dia(calcularProximoCobro(armar(0)))).toBe('2026-08-16')
  })

  it('⚠ al pagar la cuota vencida, el siguiente es el 31 — no el 16 de septiembre', () => {
    // Es la queja literal del prestamista, y la fecha que salía en su comprobante.
    expect(dia(calcularProximoCobro(armar(1)))).toBe('2026-08-31')
    expect(dia(calcularProximoCobro(armar(1)))).not.toBe('2026-09-16')
  })

  it('el calendario entero es el pactado', () => {
    expect([0, 1, 2, 3].map((n) => dia(calcularProximoCobro(armar(n)))))
      .toEqual(['2026-08-16', '2026-08-31', '2026-09-16', '2026-09-30'])
  })

  it('⚠ UN SOLO CALENDARIO: dice lo mismo que el que genera las tablas', () => {
    /* `fechaDePeriodo` es quien pone las fechas en `CuotaAmortizacion` y quien
       usa el préstamo abierto. Que las dos respuestas coincidan es la razón de
       ser del arreglo, no un detalle: de tener dos salían las dos fechas. */
    for (let n = 0; n < 4; n++) {
      const esperada = fechaDePeriodo(n + 1, {
        fechaInicio: new Date('2026-08-10T05:00:00.000Z'),
        freq: 'quincenal', diasPeriodo: 15, diaCobroMes: 16, diaCobroMes2: 31,
      })
      expect(dia(calcularProximoCobro(armar(n)))).toBe(dia(esperada))
    }
  })

  it('el 30 de septiembre, cuando el ancla es 31 y el mes no lo tiene', () => {
    // La cuarta cuota cae en un mes de 30 días: se cobra el último, no se salta.
    expect(dia(calcularProximoCobro(armar(3)))).toBe('2026-09-30')
  })

  it('el otro préstamo que reportó: 15 y 30 desde el 4 de agosto', () => {
    /* «Le digo que lo cree el 4 de agosto y me remite a fecha de pago el 15 de
       septiembre.» Con una cuota pagada decía 15 sept; le toca el 30 de ago. */
    const calc = calcularPrestamo({
      montoPrestado: 100000, tasaInteres: 20, diasPlazo: 30,
      fechaInicio: '2026-08-04', frecuencia: 'quincenal', modoInteres: 'fijo',
      diaCobroMes: 15, diaCobroMes2: 30,
    })
    const p = { ...calc, montoPrestado: 100000, estado: 'activo',
      fechaInicio: new Date('2026-08-04T05:00:00.000Z'),
      diaCobroMes: 15, diaCobroMes2: 30, pagos: [] }
    expect(dia(calcularProximoCobro({ ...p, totalPagado: 0 }))).toBe('2026-08-15')
    expect(dia(calcularProximoCobro({ ...p, totalPagado: calc.cuotaDiaria }))).toBe('2026-08-30')
  })

  it('la fecha puesta a mano sigue mandando sobre todo', () => {
    const p = { ...armar(0), proximoCobroManual: new Date('2026-09-05T05:00:00.000Z') }
    expect(dia(calcularProximoCobro(p))).toBe('2026-09-05')
  })
})
