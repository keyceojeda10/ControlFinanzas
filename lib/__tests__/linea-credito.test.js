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

/* ── EL INTERES NO CORRE POR SEGUNDOS ──────────────────────────────────────
   Medido en la app: una linea de $8.000.000 al 10% mensual, en modo «tasa fija
   mensual», mostraba «Intereses pendientes $1,04» treinta y cuatro segundos
   despues del desembolso, y la cifra subia sola mientras se miraba.

   La ayuda de esa misma opcion dice que «el interes se calcula sobre lo que el
   cliente debe AL DIA DEL CORTE». Un numero que cambia cada segundo no es el
   que se va a cobrar, y enseñarselo al cliente no cuadra con nada. */
describe('el interes se cuenta por dias enteros, no por relojes', () => {
  const l = () => ({
    tasaInteres: 10,
    modoInteres: 'fijo_mensual',
    desembolsos: [{ monto: 8_000_000, createdAt: '2026-08-01T00:00:00Z' }],
    pagosLinea: [],
    cortesLinea: [],
  })
  const desde = new Date('2026-08-01T00:00:00Z')
  const mas = (ms) => new Date(desde.getTime() + ms)

  it('a los 34 segundos: cero, no $1,04', () => {
    expect(calcularInteresesPeriodo(l(), desde, mas(34 * 1000))).toBe(0)
  })

  it('a las 23 horas sigue en cero: el dia no se ha cumplido', () => {
    expect(calcularInteresesPeriodo(l(), desde, mas(23 * 3600 * 1000))).toBe(0)
  })

  it('al dia cumplido cobra un dia: 8.000.000 x 10% / 30', () => {
    expect(calcularInteresesPeriodo(l(), desde, mas(24 * 3600 * 1000)))
      .toBe(Math.round(8_000_000 * 0.10 / 30))
  })

  it('a los 30 dias cobra el mes entero, como antes', () => {
    expect(calcularInteresesPeriodo(l(), desde, mas(30 * 24 * 3600 * 1000)))
      .toBe(800_000)
  })
})
