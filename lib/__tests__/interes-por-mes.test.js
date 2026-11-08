// «Ese abona 100 mil de capital y la mitad de los intereses… hay una diferencia de
// ganancia que dejaría yo de recibir.» Créditos Shaddai, tarjeta de Janner Ferretería:
// $3.000.000 quincenal al 12 %, 30 quincenas. 8 nov 2026.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { calcularPrestamo, recalcularTablaDesdeSaldo } from '@/lib/calculos'
import { calendarioDeCobro } from '@/lib/dias-sin-cobro'

const JANNER = { montoPrestado: 3_000_000, tasaInteres: 12, diasPlazo: 450, fechaInicio: '2026-11-07', frecuencia: 'quincenal', modoInteres: 'lineal' }
const LA_TARJETA = []
for (let k = 15; k >= 1; k--) LA_TARJETA.push(k * 12_000, k * 12_000)

describe('el interés que baja cada mes', () => {
  const c = calcularPrestamo({ ...JANNER, interesPorMes: true })
  it('⚠ da la tarjeta al peso: 180, 180, 168, 168… 12, 12', () => {
    expect(c.tablaAmortizacion.map((f) => f.interes)).toEqual(LA_TARJETA)
  })
  it('$100.000 de capital por quincena y $5.880.000 en total', () => {
    expect(c.numPeriodos).toBe(30)
    expect(c.tablaAmortizacion.every((f) => f.capital === 100_000)).toBe(true)
    expect(c.tablaAmortizacion.slice(0, 4).map((f) => f.cuotaTotal)).toEqual([280_000, 280_000, 268_000, 268_000])
    expect(c.totalAPagar).toBe(5_880_000)
  })
  it('es lo mismo que el préstamo mensual de 15 cuotas, partido en dos', () => {
    const m = calcularPrestamo({ ...JANNER, frecuencia: 'mensual', tasaInteres: 12 })
    expect(c.totalAPagar).toBe(m.totalAPagar)
  })
  it('⚠ sin la opción, Decreciente queda exactamente como estaba', () => {
    const sin = calcularPrestamo({ ...JANNER, tasaInteres: 6 })
    expect(sin.tablaAmortizacion.slice(0, 4).map((f) => f.interes)).toEqual([180_000, 174_000, 168_000, 162_000])
    expect(sin.totalAPagar).toBe(5_790_000)
    expect(calcularPrestamo(JANNER).totalAPagar).toBe(8_580_000)
  })
  it('⚠ solo aplica en quincenal: en otra frecuencia se ignora', () => {
    expect(calcularPrestamo({ ...JANNER, frecuencia: 'mensual', interesPorMes: true }).totalAPagar)
      .toBe(calcularPrestamo({ ...JANNER, frecuencia: 'mensual' }).totalAPagar)
    expect(calcularPrestamo({ ...JANNER, frecuencia: 'semanal', interesPorMes: true }).totalAPagar)
      .toBe(calcularPrestamo({ ...JANNER, frecuencia: 'semanal' }).totalAPagar)
  })
  it('la ficha lo dice con palabras', () => {
    expect(calendarioDeCobro({ frecuencia: 'quincenal', interesPorMes: true, fechaInicio: '2026-11-07' })).toBe('Se cobra cada 15 días. El interés baja cada mes')
  })
})

describe('⚠ el abono a capital no le cambia la regla', () => {
  const base = { tasaInteres: 12, fechaBase: new Date('2026-12-07T05:00:00Z'), diasPeriodo: 15, frecuencia: 'quincenal', interesPorMes: true }
  it('abona al cerrar el mes: el mes siguiente baja, y las dos quincenas pagan igual', () => {
    const t = recalcularTablaDesdeSaldo({ ...base, saldoInicial: 2_000_000, numPeriodosRestantes: 20, primerNumeroPeriodo: 3 })
    expect(t.slice(0, 4).map((f) => f.interes)).toEqual([120_000, 120_000, 108_000, 108_000])
    expect(t.reduce((a, f) => a + f.capital, 0)).toBe(2_000_000)
  })
  it('abona a mitad de mes: la quincena que falta sigue con el interés de ese mes', () => {
    const t = recalcularTablaDesdeSaldo({ ...base, saldoInicial: 2_000_000, numPeriodosRestantes: 19, primerNumeroPeriodo: 2, interesDelMes: 180_000 })
    expect(t[0].interes).toBe(180_000)
    expect(t[1].numeroPeriodo).toBe(3)
    expect(t[1].interes).toBeLessThan(180_000)
    expect(t[1].interes).toBe(t[2].interes)
  })
  it('sin la opción, el recálculo es el de siempre', () => {
    const t = recalcularTablaDesdeSaldo({ ...base, interesPorMes: false, tasaInteres: 6, saldoInicial: 1_000_000, numPeriodosRestantes: 10, primerNumeroPeriodo: 3 })
    expect(t.slice(0, 2).map((f) => f.interes)).toEqual([60_000, 54_000])
  })
})

describe('⚠ todas las vías que recalculan conocen la opción', () => {
  const lee = (f) => readFileSync(f, 'utf8')
  it.each([
    ['app/api/prestamos/route.js', 'interesPorMes: interesPorMesDb,'],
    ['app/api/prestamos/[id]/route.js', 'interesPorMes: interesPorMesUsar,'],
    ['app/api/prestamos/[id]/route.js', 'interesPorMes: !!p.interesPorMes,'],
    ['app/api/prestamos/[id]/renovar/route.js', 'interesPorMes: interesPorMesDb,'],
    ['app/api/prestamos/[id]/pagos/route.js', 'interesPorMes: !!prestamoActualizado.interesPorMes,'],
    ['components/prestamos/EditarPrestamo.jsx', "interesPorMes: !!p.interesPorMes && modoInteres === 'lineal'"],
    ['components/prestamos/RenovarPrestamo.jsx', "interesPorMes: !!prestamoAnterior?.interesPorMes && modo === 'lineal'"],
  ])('%s', (f, texto) => { expect(lee(f)).toContain(texto) })
})
