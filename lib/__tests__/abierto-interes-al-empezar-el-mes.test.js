import { describe, it, expect } from 'vitest'
import { devengosPendientes, periodoEnCursoAbierto, capitalAbiertoAlDia, reajusteDeDevengos } from '@/lib/calculos'

/* ══ EL INTERÉS DEL MES VA SOBRE EL CAPITAL QUE HABÍA AL EMPEZAR EL MES ══════
 *
 * Decisión del dueño, 16 oct 2026, con dos casos de Inversiones Jk delante:
 *
 *   · Jaquelin Pitre debía $3.100.000 de capital. Le cobró «$372.000, que es
 *     interés» (12 % de $3.100.000) y DESPUÉS le abonó $700.000. El abono baja
 *     el interés del mes siguiente, no el de éste.
 *   · Frank Martínez: «el primer mes me dio 144 de interés y 200 de capital,
 *     el mes siguiente 120 y 200». El sistema le cobraba 144 el segundo mes
 *     —el préstamo se cargó con fecha atrás y los abonos llegaron después del
 *     interés— y le salía «debe $824.000» con 21 días de mora que no existían.
 *
 * Antes convivían dos reglas: el cron cobraba sobre el capital al CERRAR el
 * mes y contando solo los abonos «capital»; cobrar el interés por adelantado
 * lo hacía sobre el capital de ese momento. Ahora es una sola, y un pago
 * «completo» que bajó capital también cuenta.
 */

const T = (d) => `${d}T17:00:00.000Z` // mediodía en Colombia
const FRANK = {
  id: 'frank', modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual', estado: 'activo',
  montoPrestado: 1_200_000, tasaInteres: 12, fechaInicio: '2026-07-25T05:00:00.000Z', cuotasAmortizacion: [],
  pagos: [
    { tipo: 'intereses', montoPagado: 144_000, fechaPago: T('2026-08-25') },
    { tipo: 'capital', montoPagado: 200_000, fechaPago: T('2026-08-25') },
    { tipo: 'intereses', montoPagado: 120_000, fechaPago: T('2026-09-25') },
    { tipo: 'capital', montoPagado: 200_000, fechaPago: T('2026-09-25') },
  ],
  devengos: [],
}

describe('Frank: el abono del día del corte baja el mes que empieza', () => {
  const d = devengosPendientes(FRANK, Date.parse('2026-10-26T05:00:00.000Z'))
  const por = Object.fromEntries(d.map((x) => [x.periodo, x.interes]))
  it('agosto sobre $1.200.000, septiembre sobre $1.000.000, octubre sobre $800.000', () => {
    expect(por).toEqual({ '2026-08-25': 144_000, '2026-09-25': 120_000, '2026-10-25': 96_000 })
  })
})

const JAQUELIN = {
  id: 'jaq', modoInteres: 'solo_interes', sinPlazo: true, frecuencia: 'mensual', estado: 'activo',
  montoPrestado: 3_700_000, tasaInteres: 12, fechaInicio: '2026-08-18T05:00:00.000Z', cuotasAmortizacion: [],
  devengos: [{ periodo: '2026-09-18', interes: 444_000, capitalBase: 3_700_000 }],
  pagos: [
    { tipo: 'intereses', montoPagado: 444_000, fechaPago: T('2026-09-16') },
    { tipo: 'completo', montoPagado: 600_000, fechaPago: T('2026-09-16') },
  ],
}

describe('Jaquelin: un «completo» que bajó capital también cuenta', () => {
  it('el capital al empezar el mes de octubre es $3.100.000', () => {
    expect(capitalAbiertoAlDia(JAQUELIN, new Date('2026-09-18T05:00:00.000Z'))).toBe(3_100_000)
  })
  it('el interés del mes en curso son $372.000, aunque abone a mitad de mes', () => {
    const conAbono = { ...JAQUELIN, pagos: [...JAQUELIN.pagos, { tipo: 'completo', montoPagado: 700_000, fechaPago: T('2026-10-16') }] }
    expect(periodoEnCursoAbierto(JAQUELIN, Date.parse(T('2026-10-16'))).interesPeriodo).toBe(372_000)
    expect(periodoEnCursoAbierto(conAbono, Date.parse(T('2026-10-16'))).interesPeriodo).toBe(372_000)
  })
  it('y el de noviembre ya va sobre $2.400.000: $288.000, no $444.000', () => {
    const despues = {
      ...JAQUELIN,
      devengos: [...JAQUELIN.devengos, { periodo: '2026-10-18', interes: 372_000, capitalBase: 3_100_000 }],
      pagos: [...JAQUELIN.pagos,
        { tipo: 'intereses', montoPagado: 372_000, fechaPago: T('2026-10-16') },
        { tipo: 'completo', montoPagado: 700_000, fechaPago: T('2026-10-16') }],
    }
    const d = devengosPendientes(despues, Date.parse('2026-11-18T06:00:00.000Z'))
    expect(d).toEqual([expect.objectContaining({ periodo: '2026-11-18', capitalBase: 2_400_000, interes: 288_000 })])
  })
})

describe('un abono que llega con fecha atrás corrige el interés ya asentado', () => {
  // Así lo cargó el cliente: el préstamo con fecha de julio (se asentaron
  // agosto y septiembre sobre $1.200.000) y LUEGO los pagos, cambiándoles la fecha.
  const asentados = [
    { periodo: '2026-08-25', interes: 144_000, capitalBase: 1_200_000 },
    { periodo: '2026-09-25', interes: 144_000, capitalBase: 1_200_000 },
  ]
  const antes = { ...FRANK, devengos: asentados, pagos: FRANK.pagos.slice(0, 1).concat({ tipo: 'capital', montoPagado: 200_000, fechaPago: T('2026-10-16') }) }
  const despues = { ...antes, pagos: FRANK.pagos.slice(0, 2) }

  it('septiembre baja a $120.000 y agosto no se mueve', () => {
    expect(reajusteDeDevengos(antes, despues)).toEqual([
      { periodo: '2026-09-25', capitalBase: 1_000_000, interes: 120_000, diferencia: -24_000 },
    ])
  })
  it('sin cambio de fechas no hay nada que reajustar', () => {
    expect(reajusteDeDevengos(despues, despues)).toEqual([])
  })
  it('anular el abono devuelve septiembre a $144.000', () => {
    const corregido = { ...despues, devengos: [asentados[0], { periodo: '2026-09-25', interes: 120_000, capitalBase: 1_000_000 }] }
    const sinAbono = { ...corregido, pagos: corregido.pagos.filter((p) => p.tipo !== 'capital') }
    expect(reajusteDeDevengos(corregido, sinAbono)).toEqual([
      { periodo: '2026-09-25', capitalBase: 1_200_000, interes: 144_000, diferencia: 24_000 },
    ])
  })
  it('un devengo parcial (liquidación) no se toca', () => {
    const parcial = { ...antes, devengos: [asentados[0], { periodo: '2026-09-25', interes: 50_000, capitalBase: 1_200_000 }] }
    expect(reajusteDeDevengos(parcial, { ...parcial, pagos: despues.pagos })).toEqual([])
  })
})

describe('lo que se ve en la hoja y la cuota del abierto', () => {
  it('cobrar el interés del mes que corre no baja el saldo en la vista previa', async () => {
    const { adaptarDespuesDelPago } = await import('@/lib/adaptadores/pago')
    const { filas } = adaptarDespuesDelPago({ saldoPendiente: 3_100_000 }, { monto: 372_000, tipo: 'intereses', deudaQueNace: 372_000 })
    const saldo = filas.find((f) => f.clave === 'saldo')
    expect(saldo.valor).toBe(saldo.antes)
    expect(saldo.nota).toBe('Igual: pagó interés, no capital')
  })
  it('la cuota que toca es el interés del mes sobre el capital de hoy, no la de cuando se creó', async () => {
    const { calcularCuotaQueToca } = await import('@/lib/calculos')
    const hoy = {
      ...JAQUELIN, cuotaDiaria: 444_000, totalAPagar: 4_516_000,
      devengos: [...JAQUELIN.devengos, { periodo: '2026-10-18', interes: 372_000, capitalBase: 3_100_000 }],
      pagos: [...JAQUELIN.pagos,
        { tipo: 'intereses', montoPagado: 372_000, fechaPago: T('2026-10-16') },
        { tipo: 'completo', montoPagado: 700_000, fechaPago: T('2026-10-16') }],
    }
    const real = Date.now
    Date.now = () => Date.parse('2026-10-20T17:00:00.000Z')
    try { expect(calcularCuotaQueToca(hoy)).toBe(288_000) } finally { Date.now = real }
  })
  it('la hoja usa el texto del abierto y le pasa al adaptador el interés que nace', () => {
    const src = require('node:fs').readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')
    expect(src).toMatch(/deudaQueNace: interesQueNace,/)
    expect(src).toMatch(/if \(tipo === 'intereses' && esAbierto\) \{/)
  })
})
