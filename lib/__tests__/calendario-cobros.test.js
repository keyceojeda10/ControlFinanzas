// El calendario de cobros (6 nov 2026): «qué día le toca a qué persona… si le pica
// un día, le sale en orden los cobros que tiene ese día». Sin calendario propio:
// las fechas son las de `tocaCobrarEn` y hoy es `loDeHoyDelPrestamo`.
import { describe, it, expect, afterEach, vi } from 'vitest'
import { armarCalendario } from '@/lib/calendario-cobros'
import { loDeHoyDelPrestamo } from '@/lib/dinero/esperado'

const d = (s) => new Date(`${s}T05:00:00.000Z`)
afterEach(() => vi.useRealTimers())
const elDia = (s) => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${s}T17:00:00.000Z`)) }

const albanil = (extra = {}) => ({
  id: 'p-alb', estado: 'activo', esClavo: false, frecuencia: 'quincenal', modoInteres: 'fijo',
  fechaInicio: d('2026-11-06'), diasPlazo: 60, montoPrestado: 400_000,
  cuotaDiaria: 140_000, totalAPagar: 560_000, totalPagado: 0, pagos: [], pagosHoy: [], cuotasAmortizacion: [],
  diaCobroSemana: 6, diaCobroMes: null, diaCobroMes2: null, primerCobro: d('2026-11-14'), ...extra,
})
const diario = (extra = {}) => ({
  id: 'p-dia', estado: 'activo', esClavo: false, frecuencia: 'diario', modoInteres: 'fijo',
  fechaInicio: d('2026-11-01'), diasPlazo: 20, montoPrestado: 100_000,
  cuotaDiaria: 6_000, totalAPagar: 120_000, totalPagado: 0, pagos: [], pagosHoy: [], cuotasAmortizacion: [], ...extra,
})
const cli = (id, nombre, prestamos, ruta = { id: 'r1', nombre: 'Centro' }) => ({ id, nombre, ruta, diasSinCobro: null, prestamos })

describe('lo que viene', () => {
  it('⚠ el albañil: los 4 sábados, un sábado sí y otro no, y nada más', () => {
    elDia('2026-11-07')
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil()])], hoy: '2026-11-07', desde: '2026-11-07', hasta: '2027-01-31', conPasado: false })
    expect(Object.keys(dias)).toEqual(['2026-11-14', '2026-11-28', '2026-12-12', '2026-12-26'])
    expect(Object.values(dias).every((x) => x.total === 140_000 && x.nombres[0] === 'Pedro')).toBe(true)
  })
  it('se cobra hasta saldar: 3 cuotas cubiertas y le quedan $20.000 → la última fecha, por $20.000', () => {
    elDia('2026-11-07')
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ totalPagado: 540_000, pagos: [{ montoPagado: 540_000, fechaPago: d('2026-11-07'), tipo: 'completo' }] })])], hoy: '2026-11-07', desde: '2026-11-08', hasta: '2026-12-31', conPasado: false })
    expect(Object.entries(dias).map(([k, v]) => [k, v.total])).toEqual([['2026-12-26', 20_000]])
  })
})

describe('⚠ lo que viene empieza en su próximo cobro', () => {
  it('pagó por adelantado hasta el 28: no sale con cobro el 14 ni el 28', () => {
    elDia('2026-11-07')
    const p = albanil({ totalPagado: 280_000 })
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [p])], hoy: '2026-11-07', desde: '2026-11-07', hasta: '2027-01-31', conPasado: false })
    expect(Object.keys(dias)).toEqual(['2026-12-12', '2026-12-26'])
  })
  it('la fecha aplazada a mano sale en su día, aunque no sea de calendario', () => {
    elDia('2026-11-07')
    const p = albanil({ proximoCobroManual: d('2026-11-18') })
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [p])], hoy: '2026-11-07', desde: '2026-11-07', hasta: '2026-11-30', conPasado: false })
    expect(Object.keys(dias)).toEqual(['2026-11-18'])
  })
  it('el atrasado sigue con su calendario: lo que viene no se le borra', () => {
    elDia('2026-11-20')
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil()])], hoy: '2026-11-20', desde: '2026-11-21', hasta: '2026-12-31', conPasado: false })
    expect(Object.keys(dias)).toEqual(['2026-11-28', '2026-12-12', '2026-12-26'])
  })
})

describe('hoy es «Cobrar hoy», al peso', () => {
  it('mismo monto que loDeHoyDelPrestamo, pendiente o cobrado', () => {
    elDia('2026-11-14')
    const p = albanil()
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [p])], hoy: '2026-11-14', desde: '2026-11-14', hasta: '2026-11-14', conPasado: false, detalle: '2026-11-14' })
    expect(dias['2026-11-14'].total).toBe(loDeHoyDelPrestamo(p, {}).toca)
    expect(dias['2026-11-14'].items[0].estado).toBe('pendiente')
    const pagado = albanil({ totalPagado: 140_000, pagos: [{ montoPagado: 140_000, fechaPago: new Date('2026-11-14T15:00:00Z'), tipo: 'completo' }], pagosHoy: [{ montoPagado: 140_000, fechaPago: new Date('2026-11-14T15:00:00Z'), tipo: 'completo' }] })
    const d2 = armarCalendario({ clientes: [cli('c1', 'Pedro', [pagado])], hoy: '2026-11-14', desde: '2026-11-14', hasta: '2026-11-14', conPasado: false, detalle: '2026-11-14' })
    expect(d2['2026-11-14'].items[0]).toMatchObject({ estado: 'cobrado', monto: 140_000 })
  })
  it('el clavo y el préstamo que no está activo no salen', () => {
    elDia('2026-11-07')
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ esClavo: true }), albanil({ id: 'x', estado: 'completado' })])], hoy: '2026-11-07', desde: '2026-11-07', hasta: '2026-12-31', conPasado: false })
    expect(dias).toEqual({})
  })
})

describe('lo pasado (Básico en adelante)', () => {
  it('quién pagó, con lo que pagó, y a quién le tocaba y no pagó', () => {
    elDia('2026-11-05')
    const clientes = [cli('c1', 'Ana', [diario()]), cli('c2', 'Beto', [diario({ id: 'p-2' })])]
    const pagosPasados = [{ prestamoId: 'p-dia', clienteId: 'c1', dia: '2026-11-03', monto: 6_000 }]
    const dias = armarCalendario({ clientes, pagosPasados, hoy: '2026-11-05', desde: '2026-11-03', hasta: '2026-11-03', conPasado: true, detalle: '2026-11-03' })
    const it3 = dias['2026-11-03'].items.map((x) => [x.nombre, x.estado, x.monto])
    expect(it3).toEqual(expect.arrayContaining([['Ana', 'cobrado', 6_000], ['Beto', 'sin_pagar', 6_000]]))
    expect(dias['2026-11-03'].cobrado).toBe(6_000)
    expect(dias['2026-11-03'].sinPagar).toBe(6_000)
  })
  it('⚠ quien pagó por adelantado no sale «no pagó» en la fecha que ya tenía cubierta', () => {
    elDia('2026-12-01')
    // Pagó dos cuotas juntas el 14: el 28 no debía nada.
    const pagos = [{ prestamoId: 'p-alb', clienteId: 'c1', dia: '2026-11-14', monto: 280_000 }]
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ totalPagado: 280_000 })])], pagosPasados: pagos, hoy: '2026-12-01', desde: '2026-11-01', hasta: '2026-11-30', conPasado: true, detalle: '2026-11-28' })
    expect(dias['2026-11-14']).toMatchObject({ cobrado: 280_000, nSinPagar: 0 })
    expect(dias['2026-11-28']).toBeUndefined()
  })
  it('lo pagado antes del mes también cubre', () => {
    elDia('2026-12-30')
    const antes = new Map([['p-alb', 280_000]])
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ totalPagado: 280_000 })])], pagadoAntes: antes, hoy: '2026-12-30', desde: '2026-12-01', hasta: '2026-12-31', conPasado: true })
    // Con dos cuotas cubiertas, el 12 sí tocaba y no pagó; el 26 tampoco.
    expect(dias['2026-12-12']).toMatchObject({ nSinPagar: 1, sinPagar: 140_000 })
    expect(dias['2026-12-26']).toMatchObject({ nSinPagar: 1, sinPagar: 140_000 })
  })
  it('el que iba atrasado sí sale, por lo que le faltaba de esa cuota', () => {
    elDia('2026-12-01')
    const antes = new Map([['p-alb', 200_000]])
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ totalPagado: 200_000 })])], pagadoAntes: antes, hoy: '2026-12-01', desde: '2026-11-20', hasta: '2026-11-30', conPasado: true })
    expect(dias['2026-11-28']).toMatchObject({ nSinPagar: 1, sinPagar: 80_000 })
  })
  it('el abono previo cubre cuotas pero no es cobro de ese día', () => {
    elDia('2026-12-01')
    const pagos = [{ prestamoId: 'p-alb', clienteId: 'c1', dia: '2026-11-14', monto: 140_000, previo: true }]
    const dias = armarCalendario({ clientes: [cli('c1', 'Pedro', [albanil({ totalPagado: 140_000 })])], pagosPasados: pagos, hoy: '2026-12-01', desde: '2026-11-01', hasta: '2026-11-30', conPasado: true })
    expect(dias['2026-11-14']).toBeUndefined()
    expect(dias['2026-11-28']).toMatchObject({ nSinPagar: 1, cobrado: 0 })
  })
  it('sin el plan no sale nada del pasado aunque se lo pasen', () => {
    elDia('2026-11-05')
    const dias = armarCalendario({ clientes: [cli('c1', 'Ana', [diario()])], pagosPasados: [{ prestamoId: 'p-dia', clienteId: 'c1', dia: '2026-11-03', monto: 6_000 }], hoy: '2026-11-05', desde: '2026-11-05', hasta: '2026-11-05', conPasado: false })
    expect(dias['2026-11-03']).toBeUndefined()
  })
})

describe('la lista del día', () => {
  it('en orden de la ruta, y la ruta por nombre; sin ruta al final', () => {
    elDia('2026-11-02')
    const clientes = [
      cli('c1', 'Zoila', [diario({ id: 'a' })], { id: 'r2', nombre: 'Norte' }),
      cli('c2', 'Ana', [diario({ id: 'b' })], { id: 'r1', nombre: 'Centro' }),
      cli('c3', 'Carlos', [diario({ id: 'c' })], null),
      cli('c4', 'Berta', [diario({ id: 'e' })], { id: 'r1', nombre: 'Centro' }),
    ]
    const dias = armarCalendario({ clientes, hoy: '2026-11-02', desde: '2026-11-03', hasta: '2026-11-03', conPasado: false, detalle: '2026-11-03' })
    expect(dias['2026-11-03'].items.map((x) => x.nombre)).toEqual(['Ana', 'Berta', 'Zoila', 'Carlos'])
    expect(dias['2026-11-03'].nombres).toHaveLength(3)
    expect(dias['2026-11-03'].n).toBe(4)
  })
})
