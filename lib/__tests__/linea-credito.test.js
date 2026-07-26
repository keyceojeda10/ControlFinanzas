import { describe, it, expect } from 'vitest'
import { calcularInteresesPeriodo, aplicarPago } from '../linea-credito'

const linea = (modoInteres) => ({
  tasaInteres: 7.5,
  modoInteres,
  desembolsos: [{ monto: 60_000_000, createdAt: '2026-01-01T00:00:00Z' }],
  pagosLinea: [],
  cortesLinea: [],
})

describe('interes de linea de credito — proporcional al tiempo (no duplica)', () => {
  it('fijo_mensual: 0 dias transcurridos = 0 interes (antes daba un mes completo)', () => {
    const l = linea('fijo_mensual')
    const cero = calcularInteresesPeriodo(l, new Date('2026-02-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'))
    expect(cero).toBe(0)
  })

  it('fijo_mensual: 30 dias = un mes de interes (60M x 7.5% = 4.5M)', () => {
    const l = linea('fijo_mensual')
    const mes = calcularInteresesPeriodo(l, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z'))
    expect(mes).toBe(4_500_000)
  })

  it('al_corte: 0 dias = 0 (antes cobraba un mes apenas se generaba el corte)', () => {
    const l = linea('al_corte')
    expect(calcularInteresesPeriodo(l, new Date('2026-02-01T00:00:00Z'), new Date('2026-02-01T00:00:00Z'))).toBe(0)
  })

  it('diario_saldo: 30 dias ~ un mes', () => {
    const l = linea('diario_saldo')
    const val = calcularInteresesPeriodo(l, new Date('2026-01-01T00:00:00Z'), new Date('2026-01-31T00:00:00Z'))
    expect(val).toBe(4_500_000)
  })
})

describe('aplicarPago: interes primero, luego capital', () => {
  it('un pago cubre interes y el resto baja capital', () => {
    // linea con cortes que ya generaron interes, para tener interesesPendientes>0
    const l = {
      tasaInteres: 10,
      modoInteres: 'fijo_mensual',
      cupoMaximo: 100_000_000,
      desembolsos: [{ monto: 10_000_000, createdAt: '2020-01-01T00:00:00Z' }],
      pagosLinea: [],
      cortesLinea: [{ fechaCorte: '2999-01-01T00:00:00Z', interesesGenerados: 1_000_000, saldoNuevo: 11_000_000 }],
    }
    const r = aplicarPago(l, 3_000_000)
    expect(r.montoAInteres).toBe(1_000_000)
    expect(r.montoACapital).toBe(2_000_000)
  })
})
