import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fronterasBogota } from '../admin/dias-bogota.js'

describe('fronterasBogota: el día del panel empieza a medianoche de Bogotá', () => {
  it('el registro de las 10:59 p. m. del 21 nov es de «ayer» visto el 22 nov', () => {
    const f = fronterasBogota(new Date('2026-11-22T14:37:00Z')) // 9:37 a. m. Bogotá, domingo
    expect(f.inicioHoy.toISOString()).toBe('2026-11-22T05:00:00.000Z')
    expect(f.inicioAyer.toISOString()).toBe('2026-11-21T05:00:00.000Z')
    const registros = ['2026-11-21T19:38:00Z', '2026-11-22T03:59:00Z'].map((s) => new Date(s))
    expect(registros.filter((r) => r >= f.inicioAyer && r < f.inicioHoy)).toHaveLength(2)
  })

  it('a las 8 p. m. de Bogotá sigue siendo el mismo día (en UTC ya es mañana)', () => {
    const f = fronterasBogota(new Date('2026-11-22T01:00:00Z')) // 21 nov, 8 p. m. Bogotá
    expect(f.inicioHoy.toISOString()).toBe('2026-11-21T05:00:00.000Z')
  })

  it('semana (lunes o domingo) y mes', () => {
    const f = fronterasBogota(new Date('2026-11-22T14:37:00Z')) // domingo
    expect(f.inicioSemanaLunes.toISOString()).toBe('2026-11-16T05:00:00.000Z')
    expect(f.inicioSemanaDomingo.toISOString()).toBe('2026-11-22T05:00:00.000Z')
    expect(f.inicioMes.toISOString()).toBe('2026-11-01T05:00:00.000Z')
    // 1 dic a las 2 a. m. UTC todavía es 30 nov en Bogotá
    expect(fronterasBogota(new Date('2026-12-01T02:00:00Z')).inicioMes.toISOString()).toBe('2026-11-01T05:00:00.000Z')
  })

  it('las pantallas del admin no vuelven a cortar el día con la hora del servidor', () => {
    for (const f of ['activacion', 'negocio', 'stats', 'whatsapp-bot']) {
      const src = readFileSync(`app/api/admin/${f}/route.js`, 'utf8')
      expect(src, f).not.toMatch(/new Date\((now|ahora)\.getFullYear\(\), *(now|ahora)\.getMonth\(\), *(now|ahora)\.getDate\(\)\)/)
      expect(src, f).not.toMatch(/const inicioMes *= *new Date\((now|ahora)\.getFullYear\(\)/)
      expect(src, f).toMatch(/fronterasBogota\(/)
    }
  })
})
