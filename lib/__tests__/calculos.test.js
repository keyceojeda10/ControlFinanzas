import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '../calculos'

const base = { montoPrestado: 500000, tasaInteres: 20, fechaInicio: '2026-01-01' }

describe('calcularPrestamo — modo fijo (clasico, default)', () => {
  // Estos dos tests fijaban la regla vieja "4 semanas = 1 mes", que hacia que
  // un mes durara 28 dias solo en frecuencia semanal (las otras tres daban 30).
  // Un prestamo semanal cobraba 6,67% mas de interes que el mismo prestamo
  // cobrado a diario, sin durar un dia mas. Ahora el interes es proporcional a
  // los dias reales, igual que en las otras frecuencias.
  it('semanal 8 semanas = 56 dias = 1,867 meses', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'fijo' })
    // 56/30 = 1,8667 meses al 20% = $186.667 → total $686.667 → cuota ceil100
    expect(r.totalAPagar).toBe(687200)
    expect(r.cuotaDiaria).toBe(85900)
    expect(r.totalInteres).toBe(187200)
    expect(r.numPeriodos).toBe(8)
    expect(r.modoInteres).toBe('fijo')
  })

  it('semanal 4 semanas = 28 dias = 0,933 meses', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 28, frecuencia: 'semanal', modoInteres: 'fijo' })
    // 28 dias no son un mes: son 28/30. Antes se cobraban como 30.
    expect(r.totalAPagar).toBe(593600)
    expect(r.cuotaDiaria).toBe(148400)
    expect(r.totalInteres).toBe(93600)
  })

  it('quincenal 4 quincenas = 2 meses → 40% interes (cuadra con semanal 8)', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 60, frecuencia: 'quincenal', modoInteres: 'fijo' })
    expect(r.totalAPagar).toBe(700000)
    expect(r.totalInteres).toBe(200000)
    expect(r.numPeriodos).toBe(4)
  })

  it('mensual 2 meses → 40% interes (cuadra con semanal 8)', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 60, frecuencia: 'mensual', modoInteres: 'fijo' })
    expect(r.totalAPagar).toBe(700000)
    expect(r.totalInteres).toBe(200000)
    expect(r.numPeriodos).toBe(2)
  })

  it('diario 60 dias = 2 meses → ~40% interes', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 60, frecuencia: 'diario', modoInteres: 'fijo' })
    // 60/30 = 2 meses × 20% = $200.000; cuota 700000/60=11666.67 → ceil100 11700
    expect(r.cuotaDiaria).toBe(11700)
    expect(r.numPeriodos).toBe(60)
  })

  it('default sin modoInteres usa fijo', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal' })
    expect(r.modoInteres).toBe('fijo')
    expect(r.totalAPagar).toBe(687200)
  })
})

describe('calcularPrestamo — modo unico', () => {
  it('cobra 20% una sola vez sin importar plazo', () => {
    const r4 = calcularPrestamo({ ...base, diasPlazo: 28, frecuencia: 'semanal', modoInteres: 'unico' })
    const r8 = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'unico' })
    const r12 = calcularPrestamo({ ...base, diasPlazo: 84, frecuencia: 'semanal', modoInteres: 'unico' })
    expect(r4.totalInteres).toBe(100000)
    expect(r8.totalInteres).toBe(100000)
    expect(r12.totalInteres).toBe(100000)
    expect(r8.cuotaDiaria).toBe(75000) // 600000/8
  })
})

describe('calcularPrestamo — modo saldo (amortizacion)', () => {
  it('da menos interes total que el modo fijo', () => {
    const saldo = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'saldo' })
    const fijo = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'fijo' })
    expect(saldo.totalInteres).toBeGreaterThan(0)
    expect(saldo.totalInteres).toBeLessThan(fijo.totalInteres)
    expect(saldo.modoInteres).toBe('saldo')
  })

  it('tasa 0 → cuota = monto / periodos (sin division por cero)', () => {
    const r = calcularPrestamo({ ...base, tasaInteres: 0, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'saldo' })
    expect(r.totalInteres).toBe(0)
    expect(r.cuotaDiaria).toBe(62500) // 500000/8
  })
})

describe('calcularPrestamo — modo manual', () => {
  it('respeta la cuota fijada por el prestamista', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', cuotaManual: 90000 })
    expect(r.cuotaDiaria).toBe(90000)
    expect(r.totalAPagar).toBe(720000) // 90000 × 8
    expect(r.modoManual).toBe(true)
    expect(r.modoInteres).toBe('manual')
  })

  it('cuotaManual gana incluso si se pasa otro modoInteres', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'fijo', cuotaManual: 90000 })
    expect(r.modoInteres).toBe('manual')
    expect(r.cuotaDiaria).toBe(90000)
  })
})

describe('calcularPrestamo — legacy proporcional (retrocompatibilidad)', () => {
  it('llamada con redondeo (firma vieja) usa calculo proporcional dias/30', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', redondeo: 'exacto' })
    // 56/30 × 20% × 500000 = 186666.67 → total ~687000
    expect(r.modoInteres).toBe('proporcional')
    expect(r.totalInteres).toBeGreaterThan(180000)
    expect(r.totalInteres).toBeLessThan(195000)
  })

  it('proporcional explicito da el calculo viejo', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 56, frecuencia: 'semanal', modoInteres: 'proporcional' })
    expect(r.modoInteres).toBe('proporcional')
    expect(r.numPeriodos).toBe(8)
  })
})

describe('calcularPrestamo — cuotas parejas y redondeo $100', () => {
  it('todas las cuotas iguales, total = cuota × periodos', () => {
    const r = calcularPrestamo({ ...base, diasPlazo: 42, frecuencia: 'semanal', modoInteres: 'fijo' })
    // 6 semanas = 42 dias = 1,4 meses → 28% = 140000 → total 640000
    //   → cuota 106667 → ceil100 106700
    expect(r.cuotaDiaria).toBe(106700)
    expect(r.totalAPagar).toBe(106700 * 6)
    expect(r.ultimaCuota).toBe(r.cuotaDiaria)
  })
})
