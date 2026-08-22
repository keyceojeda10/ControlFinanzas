import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '@/lib/calculos'

/* ══ «LA ÚLTIMA CUOTA QUEDA EN $0» ════════════════════════════════════════
 *
 * Préstamos Rincón, por el banner, 17 ago 2026 — y era la segunda vez:
 *
 *   «cuando se escoge el interés a saldo (sistema francés) siempre el cálculo
 *    es incorrecto: la última cuota queda en $0, o un valor inferior, o
 *    incluso un valor exageradamente grande»
 *
 * El análisis de agosto midió los 115 préstamos en francés que YA existían y
 * concluyó que con la cuota del francés no fallaba ninguno. Es cierto para
 * esos: casi todos son de 30 cobros o menos. Barriendo 1.458 combinaciones
 * aparecían 119 con la última en cero, y no de laboratorio — $100.000 al 20% a
 * 60 cobros diarios es un préstamo corriente. En uno quedaban SIETE filas
 * seguidas en cero.
 *
 * La causa: la cuota se redondea a la centena de arriba, y en un plazo largo
 * ese redondeo acaba saldando el préstamo antes de que termine el calendario. */

const calc = (monto, tasa, frecuencia, diasPlazo, extra = {}) => calcularPrestamo({
  montoPrestado: monto, tasaInteres: tasa, diasPlazo, frecuencia, modoInteres: 'saldo',
  fechaInicio: new Date('2026-08-22T05:00:00.000Z'), ...extra,
})

describe('el francés no deja cuotas fantasma', () => {
  const CASOS = [
    [20000, 1, 'diario', 24], [20000, 5, 'diario', 60], [50000, 10, 'diario', 90],
    [100000, 20, 'diario', 60], [100000, 15, 'diario', 90], [250000, 10, 'diario', 90],
    [400000, 5, 'diario', 90], [1000000, 1, 'diario', 90],
  ]
  for (const [monto, tasa, frec, plazo] of CASOS) {
    it(`$${monto} al ${tasa}% ${frec} ${plazo}: ninguna cuota en cero`, () => {
      const c = calc(monto, tasa, frec, plazo)
      const t = c.tablaAmortizacion
      expect(t.length).toBeGreaterThan(0)
      expect(t.filter((f) => Number(f.cuotaTotal) <= 0)).toHaveLength(0)
      expect(c.ultimaCuota).toBeGreaterThan(0)
    })
  }

  it('⚠ y el plazo se ajusta con ellas: una sola verdad', () => {
    /* Dejar `numPeriodos` en 60 con una tabla de 53 son dos verdades sobre el
       mismo préstamo, y quien lea una u otra dirá cosas distintas. */
    for (const [monto, tasa, frec, plazo] of CASOS) {
      const c = calc(monto, tasa, frec, plazo)
      expect(c.numPeriodos, `${monto}/${tasa}%`).toBe(c.tablaAmortizacion.length)
      expect(new Date(c.fechaFin).getTime())
        .toBe(new Date(c.tablaAmortizacion[c.tablaAmortizacion.length - 1].fechaEsperada).getTime())
    }
  })

  it('⚠ no se pierde ni un peso al cortarlas', () => {
    // Una fila de $0 aporta cero a todas las sumas: el total no puede moverse.
    for (const [monto, tasa, frec, plazo] of CASOS) {
      const c = calc(monto, tasa, frec, plazo)
      const suma = c.tablaAmortizacion.reduce((a, f) => a + Number(f.cuotaTotal), 0)
      expect(suma, `${monto}/${tasa}%`).toBe(c.totalAPagar)
      expect(c.totalAPagar).toBeGreaterThanOrEqual(monto)
      // Y el capital sale entero: lo prestado vuelve.
      const capital = c.tablaAmortizacion.reduce((a, f) => a + Number(f.capital), 0)
      expect(Math.abs(capital - monto)).toBeLessThanOrEqual(1)
    }
  })

  it('los préstamos que ya salían bien no cambian', () => {
    /* El caso del propio Rincón, medido en agosto: 11 cuotas de $120.700 y la
       última de $120.530. No lo puede tocar este arreglo. */
    const c = calc(1200000, 3, 'mensual', 360)
    expect(c.tablaAmortizacion.length).toBe(12)
    expect(c.ultimaCuota).toBeGreaterThan(c.cuotaDiaria * 0.9)
  })
})

describe('cuando la última queda corta, se dice POR QUÉ', () => {
  it('⚠ y no se le echa la culpa a quien no la tiene', () => {
    /* El aviso decía siempre «al poner TÚ la cuota, es la última la que recoge
       la diferencia». Con la cuota del francés eso no es cierto: la cola la
       deja el redondeo. Explicar mal el porqué es otra forma de que parezca que
       el sistema calcula mal — que es como lo reportó. */
    const delSistema = calc(20000, 1, 'diario', 24)
    expect(delSistema.cuotaLaPusoElPrestamista).toBe(false)

    const aMano = calc(1000000, 5, 'mensual', 360, { cuotaManual: 430000 })
    expect(aMano.cuotaLaPusoElPrestamista).toBe(true)
  })
})
