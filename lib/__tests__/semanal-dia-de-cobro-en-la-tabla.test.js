// SEMANAL CON DÍA DE COBRO FIJO (20 nov 2026). El próximo cobro ya se corría al
// día de cobro (`aplicarDiaAncla`); la tabla derivada y «ponerse al día» no, y la
// misma tarjeta se contradecía. Helen Giraldo (Prestamos juan): prestó un
// miércoles, cobra los sábados. 334 préstamos activos en 68 negocios.
import { describe, it, expect, vi, afterEach } from 'vitest'
import { tablaDe } from '@/lib/dinero/tabla'
import {
  calcularProximoCobro, calcularDiasMora, calcularMontoEnMora, calcularMontoParaPonerseAlDia, tieneCobroPendienteHoy,
} from '@/lib/calculos'

const d = (s) => new Date(`${s}T05:00:00.000Z`)
const d10 = (x) => new Date(x).toISOString().slice(0, 10)
afterEach(() => vi.useRealTimers())
const el = (s) => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date(`${s}T23:00:00Z`)) }

// 8 cuotas de $140.000, prestó el miércoles 14 oct, cobra los sábados (6). Pagó 2.
const semanal = (extra = {}) => ({
  estado: 'activo', modoInteres: 'fijo', frecuencia: 'semanal', diaCobroSemana: 6,
  montoPrestado: 800000, totalAPagar: 1120000, cuotaDiaria: 140000, diasPlazo: 56,
  fechaInicio: d('2026-10-14'), fechaFin: d('2026-12-09'), totalPagado: 280000, pagos: [],
  ...extra,
})

describe('la tabla cae el día que se cobra', () => {
  it('todas las cuotas en sábado, la última también', () => {
    const t = tablaDe(semanal())
    expect(t).toHaveLength(8)
    expect(t.map((f) => new Date(f.fechaEsperada).getUTCDay())).toEqual(Array(8).fill(6))
    expect(d10(t[0].fechaEsperada)).toBe('2026-10-24')
    expect(d10(t[7].fechaEsperada)).toBe('2026-12-12')
  })

  it('el próximo cobro está en la tabla', () => {
    el('2026-11-19')
    const p = semanal()
    const prox = d10(calcularProximoCobro(p))
    expect(tablaDe(p).map((f) => d10(f.fechaEsperada))).toContain(prox)
  })

  it('⚠ la tarjeta no se contradice: con 3 cuotas vencidas y 2 pagadas, debe 1 en días y en plata', () => {
    el('2026-11-09') // lunes: vencieron sáb 24 oct, 31 oct y 7 nov
    const p = semanal()
    expect(calcularDiasMora(p)).toBe(2)
    expect(calcularMontoEnMora(p)).toBe(140000)
    expect(calcularMontoParaPonerseAlDia(p)).toBe(140000)
  })

  it('⚠ un jueves no pide la cuota del sábado que viene', () => {
    el('2026-11-05') // jueves: vencieron 24 y 31 oct, las dos pagadas
    const p = semanal()
    expect(calcularDiasMora(p)).toBe(0)
    expect(calcularMontoEnMora(p)).toBe(0)
    expect(calcularMontoParaPonerseAlDia(p)).toBe(0)
    expect(tieneCobroPendienteHoy(p)).toBe(false)
  })

  it('sin día fijo no cambia nada', () => {
    const t = tablaDe(semanal({ diaCobroSemana: null }))
    expect(d10(t[0].fechaEsperada)).toBe('2026-10-21')
  })
})
