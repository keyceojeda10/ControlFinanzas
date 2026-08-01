// Recalcular la tabla tras un abono no puede correr las fechas.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// Las tres funciones `recalcular*DesdeSaldo` construían las fechas con
// `setDate()/getDate()`, que son los métodos de la zona horaria de LA MÁQUINA.
//
// En producción no se notaba: el servidor va en UTC y ahí esos métodos son los
// de UTC. En una máquina en Bogotá sí — y ese es exactamente el patrón que este
// proyecto ya tiene documentado: los fallos de zona horaria son invisibles en
// local hasta que dejan de serlo.
//
// El convenio de la casa es medianoche local expresada como T05:00Z, y toda la
// aritmética va en `setUTC*`.

import { describe, it, expect } from 'vitest'
import {
  recalcularTablaDesdeSaldo,
  recalcularTablaSaldoDesdeSaldo,
  recalcularTablaSoloInteresDesdeSaldo,
} from '../calculos'

// El convenio: medianoche del 5 de julio en Colombia.
const BASE = new Date('2026-07-05T05:00:00Z')
const dia = (d) => d.toISOString().slice(0, 10)

describe('las fechas del recálculo no se corren de día', () => {
  it('decreciente: cada cuota cae en el día que toca', () => {
    const t = recalcularTablaDesdeSaldo({
      saldoInicial: 300000, tasaInteres: 10, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 2, fechaBase: BASE, diasPeriodo: 7,
    })
    expect(t.map((f) => dia(f.fechaEsperada))).toEqual(['2026-07-12', '2026-07-19', '2026-07-26'])
  })

  it('sobre saldo: igual', () => {
    const t = recalcularTablaSaldoDesdeSaldo({
      saldoInicial: 300000, tasaInteres: 10, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 2, fechaBase: BASE, diasPeriodo: 7, frecuencia: 'semanal',
    })
    expect(t.map((f) => dia(f.fechaEsperada))).toEqual(['2026-07-12', '2026-07-19', '2026-07-26'])
  })

  it('globo: igual', () => {
    const t = recalcularTablaSoloInteresDesdeSaldo({
      saldoInicial: 300000, tasaInteres: 10, numPeriodosRestantes: 3,
      primerNumeroPeriodo: 2, fechaBase: BASE, diasPeriodo: 7,
    })
    expect(t.map((f) => dia(f.fechaEsperada))).toEqual(['2026-07-12', '2026-07-19', '2026-07-26'])
  })

  /* El caso que delata el uso de métodos locales: cruzar un cambio de mes con
     un periodo largo. Con `setDate` en una máquina al oeste de UTC, la fecha
     resultante se lee un día antes. */
  it('cruzar el fin de mes tampoco lo corre', () => {
    const t = recalcularTablaDesdeSaldo({
      saldoInicial: 200000, tasaInteres: 10, numPeriodosRestantes: 2,
      primerNumeroPeriodo: 1, fechaBase: new Date('2026-01-31T05:00:00Z'), diasPeriodo: 30,
    })
    expect(t.map((f) => dia(f.fechaEsperada))).toEqual(['2026-03-02', '2026-04-01'])
  })

  it('y la hora se conserva en el convenio T05:00Z', () => {
    const t = recalcularTablaDesdeSaldo({
      saldoInicial: 100000, tasaInteres: 10, numPeriodosRestantes: 1,
      primerNumeroPeriodo: 1, fechaBase: BASE, diasPeriodo: 1,
    })
    expect(t[0].fechaEsperada.toISOString()).toBe('2026-07-06T05:00:00.000Z')
  })
})

describe('el capital se reparte entero, sin perder ni inventar pesos', () => {
  it('la suma de capital es exactamente el saldo', () => {
    for (const n of [2, 3, 7, 12]) {
      const t = recalcularTablaDesdeSaldo({
        saldoInicial: 1_000_000, tasaInteres: 8, numPeriodosRestantes: n,
        primerNumeroPeriodo: 1, fechaBase: BASE, diasPeriodo: 7,
      })
      const suma = t.reduce((a, f) => a + f.capital, 0)
      expect(suma, `con ${n} periodos`).toBe(1_000_000)
    }
  })
})
