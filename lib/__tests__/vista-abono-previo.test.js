import { describe, it, expect } from 'vitest'
import { vistaAbonoPrevio } from '@/lib/prestamos/vista-abono-previo'

// Inducción del 18 nov 2026, error 5: el abono previo no salía en el resumen
// del préstamo, ni la próxima fecha de cobro, ni si quedaba al día. El caso del
// cliente: $700.000 al 20 % mensual, quincenal, 8 quincenas, clásico → cuota
// $157.500, total $1.260.000; ya había abonado $840.000.

const base = {
  totalAPagar: 1260000, cuotaDiaria: 157500, frecuencia: 'quincenal', modoInteres: 'fijo',
  montoPrestado: 700000, tasaInteres: 20, diasPlazo: 120,
}
const HOY = new Date('2026-11-18T17:00:00.000Z').getTime()

describe('lo que dice el resumen de un préstamo que ya venía', () => {
  it('sin abono no dice nada', () => {
    expect(vistaAbonoPrevio({ ...base, abonado: 0, fechaInicio: '2026-08-25', ahora: HOY })).toBeNull()
  })

  it('lo abonado y lo que queda', () => {
    const v = vistaAbonoPrevio({ ...base, abonado: 840000, fechaInicio: '2026-08-25', ahora: HOY })
    expect(v.abonado).toBe(840000)
    expect(v.queda).toBe(420000)
  })

  it('con el abono al día, el próximo cobro es en el futuro y no hay atraso', () => {
    // Del 25 ago al 18 nov van cinco quincenas: 5 × 157.500 = 787.500 < 840.000.
    const v = vistaAbonoPrevio({ ...base, abonado: 840000, fechaInicio: '2026-08-25', ahora: HOY })
    expect(v.diasMora).toBe(0)
    expect(v.alDia).toBe(true)
    expect(v.proximo).toBeInstanceOf(Date)
    expect(v.proximo.getTime()).toBeGreaterThan(HOY - 24 * 3600e3)
  })

  it('con una fecha de inicio más vieja, el mismo abono queda atrasado', () => {
    // Del 25 jun al 18 nov van nueve quincenas: 9 × 157.500 = 1.417.500 > 840.000.
    const v = vistaAbonoPrevio({ ...base, abonado: 840000, fechaInicio: '2026-06-25', ahora: HOY })
    expect(v.diasMora).toBeGreaterThan(0)
    expect(v.alDia).toBe(false)
  })

  it('si ya pagó todo, queda en cero y al día', () => {
    const v = vistaAbonoPrevio({ ...base, abonado: 1260000, fechaInicio: '2026-06-25', ahora: HOY })
    expect(v.queda).toBe(0)
    expect(v.alDia).toBe(true)
  })

  it('con tabla o abierto no promete fechas', () => {
    expect(vistaAbonoPrevio({ ...base, modoInteres: 'lineal', abonado: 100000, fechaInicio: '2026-08-25', ahora: HOY }).proximo).toBeNull()
    expect(vistaAbonoPrevio({ ...base, sinPlazo: true, abonado: 100000, fechaInicio: '2026-08-25', ahora: HOY }).proximo).toBeNull()
  })
})
