import { describe, it, expect } from 'vitest'
import { recalcularTablaSaldoDesdeSaldo, recalcularTablaDesdeSaldo } from '../calculos'

// Tras un abono a capital en un prestamo "Sobre saldo" (frances), el recalculo
// debe: (1) usar la tasa POR MES (dividida por PERIODOS_POR_MES), y (2) generar
// cuota fija francesa que cierra el saldo. Antes caia en la de lineal y en
// semanal/quincenal cobraba 4×/2× de mas.

const base = {
  saldoInicial: 600_000,
  tasaInteres: 10,
  numPeriodosRestantes: 9,
  primerNumeroPeriodo: 2,
  fechaBase: new Date('2026-01-01T00:00:00Z'),
  diasPeriodo: 30,
}

describe('recalcularTablaSaldoDesdeSaldo (frances)', () => {
  it('mensual: interes del 1er periodo = saldo × 10% = 60.000', () => {
    const t = recalcularTablaSaldoDesdeSaldo({ ...base, frecuencia: 'mensual' })
    expect(t[0].interes).toBe(60_000)
  })

  it('semanal: interes = saldo × (10%/4) = 15.000, NO 60.000 (bug 4×)', () => {
    const t = recalcularTablaSaldoDesdeSaldo({ ...base, frecuencia: 'semanal', diasPeriodo: 7 })
    expect(t[0].interes).toBe(15_000)
  })

  it('quincenal: interes = saldo × (10%/2) = 30.000, NO 60.000 (bug 2×)', () => {
    const t = recalcularTablaSaldoDesdeSaldo({ ...base, frecuencia: 'quincenal', diasPeriodo: 15 })
    expect(t[0].interes).toBe(30_000)
  })

  it('la ultima cuota cierra el saldo exacto (saldoRestante = 0) y el capital suma el total', () => {
    const t = recalcularTablaSaldoDesdeSaldo({ ...base, frecuencia: 'mensual' })
    expect(t[t.length - 1].saldoRestante).toBe(0)
    const capital = t.reduce((a, r) => a + r.capital, 0)
    expect(capital).toBe(600_000)
  })

  it('cuota fija: las cuotas regulares (menos la ultima) son iguales', () => {
    const t = recalcularTablaSaldoDesdeSaldo({ ...base, frecuencia: 'mensual' })
    const regulares = t.slice(0, -1).map(r => r.cuotaTotal)
    expect(new Set(regulares).size).toBe(1) // todas iguales
  })

  it('contraste: la vieja (lineal) SI cobraba raw 10% en semanal (documenta el bug)', () => {
    const t = recalcularTablaDesdeSaldo({ ...base, diasPeriodo: 7 })
    // lineal usa saldo × tasa% sin dividir -> 60.000 (correcto para lineal, mal para saldo)
    expect(t[0].interes).toBe(60_000)
  })
})
