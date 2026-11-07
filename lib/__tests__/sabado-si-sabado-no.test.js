// «Le va a prestar a unos albañiles y les quiere cobrar 4 cobros, pero a los
// albañiles les pagan un sábado sí y un sábado no. Y en el sistema no hay cómo»
// — el dueño, 6 nov 2026.
//
// Antes, «quincenal + sábado» contaba 15 días y los empujaba al sábado: presta el
// 6 nov → 21 nov, 12 dic (tres semanas), 26 dic, 9 ene; «toca hoy» no volvía a
// encender nunca y salía «pendiente» desde el domingo. Ahora, con su primer cobro
// guardado, son 14 días exactos.
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  fechaDePeriodo, esSemanaPorMedio, primerCobroElegido, siguientePeriodo,
} from '@/lib/dinero/calendario'
import {
  calcularPrestamo, calcularProximoCobro, tieneCobroPendienteHoy, tienePeriodoEsperadoHoy,
  calcularMontoParaPonerseAlDia, calcularDiasMora, calcularCuotasEnMora,
} from '@/lib/calculos'
import { tocaCobrarEn } from '@/lib/dinero/esperado'
import { calendarioDeCobro } from '@/lib/dias-sin-cobro'

const d = (s) => new Date(`${s}T05:00:00.000Z`)
const iso = (f) => (f ? new Date(f).toISOString().slice(0, 10) : null)
const SABADOS = ['2026-11-14', '2026-11-28', '2026-12-12', '2026-12-26']

const prestamo = (extra = {}) => ({
  id: 'alb', estado: 'activo', frecuencia: 'quincenal', modoInteres: 'fijo',
  fechaInicio: d('2026-11-06'), diasPlazo: 60, montoPrestado: 400_000,
  cuotaDiaria: 120_000, totalAPagar: 480_000, totalPagado: 0, pagos: [], cuotasAmortizacion: [],
  diaCobroSemana: 6, diaCobroMes: null, diaCobroMes2: null, primerCobro: d('2026-11-14'),
  ...extra,
})
const pagado = (n) => prestamo({ totalPagado: n * 120_000 })

afterEach(() => vi.useRealTimers())
const elDia = (s) => { vi.useFakeTimers(); vi.setSystemTime(new Date(`${s}T17:00:00.000Z`)) }

describe('el calendario: un sábado sí y otro no', () => {
  it('las 4 fechas, 14 días exactos, todas sábado', () => {
    const args = { freq: 'quincenal', diaCobroSemana: 6, primerCobro: d('2026-11-14') }
    expect([1, 2, 3, 4].map((n) => iso(fechaDePeriodo(n, args)))).toEqual(SABADOS)
  })
  it('sin primer cobro guardado (los que ya existían) sigue el calendario de siempre', () => {
    expect(esSemanaPorMedio(prestamo({ primerCobro: null }))).toBe(false)
    expect(iso(calcularProximoCobro(prestamo({ primerCobro: null })))).toBe('2026-11-21')
  })
  it('el primer cobro elegido vale si es sábado y está en las próximas 5 semanas', () => {
    expect(iso(primerCobroElegido(d('2026-11-06'), 6, '2026-11-07'))).toBe('2026-11-07')
    expect(iso(primerCobroElegido(d('2026-11-06'), 6, '2026-11-14'))).toBe('2026-11-14')
    // Un viernes no es sábado, ni el mismo día de la entrega: el de siempre.
    expect(iso(primerCobroElegido(d('2026-11-06'), 6, '2026-11-13'))).toBe('2026-11-21')
    expect(iso(primerCobroElegido(d('2026-11-06'), 6, '2026-11-06'))).toBe('2026-11-21')
    expect(iso(primerCobroElegido(d('2026-11-06'), 6, null))).toBe('2026-11-21')
  })
  it('aplazar un cobro lo lleva al sábado de dentro de 14 días', () => {
    expect(iso(siguientePeriodo(d('2026-11-28'), 'quincenal', null, prestamo()))).toBe('2026-12-12')
  })
  it('la tarjeta lo dice con palabras', () => {
    expect(calendarioDeCobro(prestamo())).toBe('Se cobra un sábado sí y otro no')
    expect(calendarioDeCobro(prestamo({ primerCobro: null }))).toBe('Se cobra cada 15 días, los sábados')
  })
})

describe('el préstamo', () => {
  const base = { montoPrestado: 400_000, tasaInteres: 20, diasPlazo: 60, fechaInicio: '2026-11-06', frecuencia: 'quincenal', modoInteres: 'fijo' }
  it('⚠ el interés es el de 4 quincenas: mismo total y misma cuota que sin el sábado', () => {
    const con = calcularPrestamo({ ...base, diaCobroSemana: 6, primerCobro: d('2026-11-14') })
    const sin = calcularPrestamo(base)
    expect(con.totalAPagar).toBe(sin.totalAPagar)
    expect(con.cuotaDiaria).toBe(sin.cuotaDiaria)
    expect(con.numPeriodos).toBe(4)
  })
  it('el vencimiento es el último sábado', () => {
    expect(iso(calcularPrestamo({ ...base, diaCobroSemana: 6, primerCobro: d('2026-11-14') }).fechaFin)).toBe('2026-12-26')
  })
  it('en modo sobre saldo el primer tramo corto no se prorratea', () => {
    const con = calcularPrestamo({ ...base, modoInteres: 'saldo', diaCobroSemana: 6, primerCobro: d('2026-11-07') })
    const sin = calcularPrestamo({ ...base, modoInteres: 'saldo' })
    expect(con.totalAPagar).toBe(sin.totalAPagar)
  })
})

describe('próximo cobro, «toca hoy», mora: todos dicen lo mismo', () => {
  it('próximo cobro según lo pagado', () => {
    expect([0, 1, 2, 3].map((n) => iso(calcularProximoCobro(pagado(n))))).toEqual(SABADOS)
    expect(calcularProximoCobro(pagado(4))).toBeNull()
  })
  it('⚠ «toca cobrar» enciende cada sábado de cobro, y solo esos', () => {
    const p = prestamo()
    const tocan = []
    for (let t = d('2026-11-07').getTime(); t <= d('2027-01-02').getTime(); t += 86400000) {
      if (tocaCobrarEn(p, new Date(t))) tocan.push(iso(t))
    }
    expect(tocan).toEqual(SABADOS)
  })
  it('las dos copias de «toca hoy» coinciden día por día', () => {
    const p = prestamo()
    for (let t = d('2026-11-07').getTime(); t <= d('2027-01-02').getTime(); t += 86400000) {
      elDia(iso(t))
      expect(tienePeriodoEsperadoHoy(p), iso(t)).toBe(tocaCobrarEn(p, new Date(t)))
    }
  })
  it('⚠ pagó el primero: no está pendiente el domingo 22, sí el sábado 28', () => {
    elDia('2026-11-22'); expect(tieneCobroPendienteHoy(pagado(1))).toBe(false)
    elDia('2026-11-28'); expect(tieneCobroPendienteHoy(pagado(1))).toBe(true)
  })
  it('para ponerse al día el 12 dic habiendo pagado uno: dos cuotas', () => {
    elDia('2026-12-12'); expect(calcularMontoParaPonerseAlDia(pagado(1))).toBe(240_000)
  })
  it('la mora cuenta desde el sábado que no pagó', () => {
    const ahora = new Date('2026-11-30T17:00:00.000Z')
    expect(calcularDiasMora(pagado(1), [], [], ahora)).toBe(2)
    elDia('2026-12-13')
    expect(calcularCuotasEnMora(pagado(1))).toBe(2)
  })
})

describe('⚠ el abierto no entra al ciclo de 14 días', () => {
  // Cobra interés POR PERÍODO: con 14 días serían 26 intereses al año en vez de 24.
  it('al crear y al cambiar el día de cobro', async () => {
    const { readFileSync } = await import('node:fs')
    expect(readFileSync('app/api/prestamos/route.js', 'utf8'))
      .toContain('...(primerCobroSemana && !esAbierto && { diaCobroSemana: diaCobroSemanaDb, primerCobro: primerCobroSemana }),')
    expect(readFileSync('app/api/prestamos/[id]/route.js', 'utf8'))
      .toContain("if (freq === 'quincenal' && !(p.sinPlazo === true && p.modoInteres === 'solo_interes')) {")
  })
})
