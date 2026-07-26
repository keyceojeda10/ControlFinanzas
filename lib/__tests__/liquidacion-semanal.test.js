import { describe, it, expect } from 'vitest'
import { calcularLiquidacionAnticipada } from '../calculos'

// En semanal, el "mes" del prestamo son 4 semanas = 28 dias (convencion semanal=4).
// La liquidacion proporcional prorrateaba contra 30 dias -> cobraba ~6.67% menos.
// A 28 dias (= 1 mes-del-modo) la modalidad proporcional debe igualar a la de mes
// completo: ambas = un mes de interes.

describe('liquidacion semanal: proporcional prorratea contra el mes del modo (28 dias)', () => {
  const prestamo = {
    montoPrestado: 250000,
    tasaInteres: 20,
    frecuencia: 'semanal',
    modoInteres: 'fijo',
    diasPlazo: 42, // 6 semanas
    totalAPagar: 325000, // 250k + 20% × (6/4) = 75k interes
    fechaInicio: new Date('2026-01-01T05:00:00Z'),
    pagos: [],
    totalPagado: 0,
  }

  it('a 28 dias (4 semanas = 1 mes) el interes proporcional = 1 mes = 50.000', () => {
    const r = calcularLiquidacionAnticipada(prestamo, new Date('2026-01-29T05:00:00Z'))
    expect(r.proporcional.interesDevengado).toBe(50000)
  })

  it('proporcional iguala a mes completo a exactamente 1 mes-del-modo', () => {
    const r = calcularLiquidacionAnticipada(prestamo, new Date('2026-01-29T05:00:00Z'))
    expect(r.proporcional.interesDevengado).toBe(r.mesCompleto.interesDevengado)
  })
})

describe('liquidacion diario: sigue prorrateando contra 30 dias (sin cambio)', () => {
  const prestamo = {
    montoPrestado: 300000,
    tasaInteres: 20,
    frecuencia: 'diario',
    modoInteres: 'fijo',
    diasPlazo: 60,
    totalAPagar: 420000, // 300k + 20% × 2 meses = 120k
    fechaInicio: new Date('2026-01-01T05:00:00Z'),
    pagos: [],
    totalPagado: 0,
  }
  it('a 30 dias = 1 mes de interes = 60.000', () => {
    const r = calcularLiquidacionAnticipada(prestamo, new Date('2026-01-31T05:00:00Z'))
    expect(r.proporcional.interesDevengado).toBe(60000)
  })
})
