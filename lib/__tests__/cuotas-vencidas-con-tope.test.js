// «95 días en mora · 14 cuotas vencidas · $136.000», en un préstamo semanal de
// OCHO cuotas que debía cuatro. Cazado el 19 sep 2026 revisando pantallas.
//
// `calcularCuotasEnMora` contaba los períodos TRANSCURRIDOS, y el plazo no es
// un tope: pasado el vencimiento el conteo seguía subiendo. Medido contra el
// espejo: 960 de 1.974 préstamos en mora (49%) decían más cuotas vencidas de las
// que les quedaban; el peor, «340 cuotas vencidas» debiendo 19. La plata salía
// bien al lado —ya iba topada al saldo—, así que el mismo renglón daba una cifra
// cierta y otra imposible.
import { describe, it, expect } from 'vitest'
import { calcularCuotasEnMora, calcularCuotasPendientes, calcularMontoEnMora, calcularDiasMora } from '@/lib/calculos'

const dia = (s) => new Date(`${s}T05:00:00.000Z`)
// Semanal, 8 cuotas de $34.000; empezó hace meses y pagó la mitad.
const semanal = {
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'semanal',
  montoPrestado: 200000, totalAPagar: 272000, cuotaDiaria: 34000, diasPlazo: 56,
  fechaInicio: dia('2026-01-05'),
  pagos: [{ tipo: 'completo', montoPagado: 136000, fechaPago: dia('2026-02-02') }],
}

describe('las cuotas vencidas no pasan de las que quedan', () => {
  it('⚠ pasado el plazo, son las que DEBE, no los períodos que han corrido', () => {
    expect(calcularDiasMora(semanal, [], [])).toBeGreaterThan(90)
    expect(calcularCuotasPendientes(semanal)).toBe(4)
    expect(calcularCuotasEnMora(semanal, [], [])).toBe(4)
  })

  it('y la plata en mora no se mueve: ya iba topada al saldo', () => {
    expect(calcularMontoEnMora(semanal, [], [])).toBe(136000)
  })

  it('dentro del plazo sigue contando los períodos atrasados', () => {
    // Un diario de 30 cuotas que dejó de pagar hace poco: debe muchas más de
    // las que lleva atrasadas, así que manda el atraso, no el tope.
    const hace = (n) => new Date(Date.now() - n * 86400000)
    const diario = {
      estado: 'activo', modoInteres: 'fijo', frecuencia: 'diario',
      montoPrestado: 500000, totalAPagar: 600000, cuotaDiaria: 20000, diasPlazo: 30,
      fechaInicio: hace(8), pagos: [{ tipo: 'completo', montoPagado: 60000, fechaPago: hace(5) }],
    }
    const enMora = calcularCuotasEnMora(diario, [], [])
    expect(enMora).toBeGreaterThan(0)
    expect(enMora).toBeLessThan(calcularCuotasPendientes(diario))
  })

  it('un pago único vencido tiene UNA cuota vencida, no catorce', () => {
    const unico = {
      estado: 'activo', modoInteres: 'unico', frecuencia: 'mensual',
      montoPrestado: 1000000, totalAPagar: 1200000, cuotaDiaria: 0, diasPlazo: 30,
      fechaInicio: dia('2026-01-05'), pagos: [],
    }
    if (calcularDiasMora(unico, [], []) > 0) expect(calcularCuotasEnMora(unico, [], [])).toBe(1)
  })
})
