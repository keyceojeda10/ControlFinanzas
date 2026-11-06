import { describe, it, expect } from 'vitest'
import {
  devengosPendientes, periodoEnCursoAbierto, reajusteDeDevengos, capitalAlEmpezarElPeriodo,
  DIAS_DE_GRACIA_DEL_ABONO,
} from '@/lib/calculos'

/* ══ EL ABONO QUE ENTRA JUSTO DESPUÉS DEL CORTE ══════════════════════════════
 *
 * Inversiones Jk, 5 nov 2026. Angélica Leguia: $2.000.000 al 12 % con corte el 28.
 * Pagó el interés y abonó $120.000 el 30 de septiembre. Juan Carlos cobró octubre
 * sobre $1.880.000; la app, sobre $2.000.000: «me está cobrando un extra». Lo
 * pagado hasta 3 días después del corte cuenta como pagado el día del corte.
 */
const T = (d) => `${d}T17:00:00.000Z` // mediodía en Colombia
const base = (extra = {}) => ({
  id: 'x', modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual', estado: 'activo',
  montoPrestado: 2_000_000, tasaInteres: 12, fechaInicio: '2026-08-28T05:00:00.000Z',
  cuotasAmortizacion: [], devengos: [], pagos: [], ...extra,
})
const abono = (dia, m = 120_000) => ({ tipo: 'capital', montoPagado: m, fechaPago: T(dia) })
const interes = (dia, m = 240_000) => ({ tipo: 'intereses', montoPagado: m, fechaPago: T(dia) })
const ALFIN = Date.parse('2026-10-29T05:00:00.000Z')
const octubre = (p) => devengosPendientes(p, ALFIN).find((d) => d.periodo === '2026-10-28')

describe('cuánto cuenta como «justo después del corte»', () => {
  it('son 3 días', () => expect(DIAS_DE_GRACIA_DEL_ABONO).toBe(3))
  it.each([
    ['el día del corte', '2026-09-28', 225_600],
    ['2 días después (Angélica)', '2026-09-30', 225_600],
    ['3 días después, el último que cuenta', '2026-10-01', 225_600],
    ['4 días después, ya no', '2026-10-02', 240_000],
    ['a mitad de mes, baja el mes siguiente', '2026-10-15', 240_000],
  ])('%s', (_n, dia, esperado) => {
    expect(octubre(base({ pagos: [interes('2026-09-30'), abono(dia)] })).interes).toBe(esperado)
  })
  it('el tercer día cuenta hasta su última hora en Colombia', () => {
    const p = (fechaPago) => base({ pagos: [{ tipo: 'capital', montoPagado: 120_000, fechaPago }] })
    expect(octubre(p('2026-10-02T04:59:00.000Z')).interes).toBe(225_600) // 1 oct, 11:59 p. m.
    expect(octubre(p('2026-10-02T05:00:00.000Z')).interes).toBe(240_000) // 2 oct, 12:00 a. m.
  })
})

describe('lo que no cambia', () => {
  it('el primer mes: la fecha de inicio no es un corte que se pague tarde', () => {
    const d = devengosPendientes(base({ pagos: [abono('2026-08-30')] }), ALFIN)
    expect(d.find((x) => x.periodo === '2026-09-28').interes).toBe(240_000)
    expect(d.find((x) => x.periodo === '2026-10-28').interes).toBe(225_600)
  })
  it.each(['semanal', 'quincenal', 'diario'])('%s: solo el mismo día del corte', (frecuencia) => {
    const p = base({ frecuencia, pagos: [] })
    const inicio = new Date('2026-09-28T05:00:00.000Z')
    const conAbono = { ...p, pagos: [abono('2026-09-29')] }
    expect(capitalAlEmpezarElPeriodo(conAbono, inicio)).toBe(2_000_000)
    expect(capitalAlEmpezarElPeriodo({ ...p, pagos: [abono('2026-09-28')] }, inicio)).toBe(1_880_000)
  })
})

describe('todas las vías dicen lo mismo', () => {
  it('el mes en curso, que es la cuota que se le pide al cliente', () => {
    const p = base({
      devengos: [{ periodo: '2026-09-28', interes: 240_000, capitalBase: 2_000_000 }],
      pagos: [interes('2026-09-30'), abono('2026-09-30')],
    })
    expect(periodoEnCursoAbierto(p, Date.parse(T('2026-10-10'))).capitalBase).toBe(1_880_000)
    expect(periodoEnCursoAbierto(p, Date.parse(T('2026-10-10'))).interesPeriodo).toBe(225_600)
  })
  it('un abono dentro de la gracia corrige el mes ya asentado', () => {
    const devengos = [
      { periodo: '2026-09-28', interes: 240_000, capitalBase: 2_000_000 },
      { periodo: '2026-10-28', interes: 240_000, capitalBase: 2_000_000 },
    ]
    const despues = base({ devengos, pagos: [abono('2026-09-30')] })
    const antes = base({ devengos, pagos: [] })
    expect(reajusteDeDevengos(antes, despues)).toEqual([
      { periodo: '2026-10-28', capitalBase: 1_880_000, interes: 225_600, diferencia: -14_400 },
    ])
  })
  it('anularlo lo devuelve', () => {
    const devengos = [
      { periodo: '2026-09-28', interes: 240_000, capitalBase: 2_000_000 },
      { periodo: '2026-10-28', interes: 225_600, capitalBase: 1_880_000 },
    ]
    const antes = base({ devengos, pagos: [abono('2026-09-30')] })
    const despues = base({ devengos, pagos: [] })
    expect(reajusteDeDevengos(antes, despues)[0]).toMatchObject({ capitalBase: 2_000_000, interes: 240_000, diferencia: 14_400 })
  })
})
