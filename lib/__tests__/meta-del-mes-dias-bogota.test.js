import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { inicioDia } from '../dinero/esperado.js'

/* La meta del mes de Analíticas (y su PDF) recorría del 31 oct al 29 nov en
   producción: `new Date(año, mes, día)` en un servidor UTC es medianoche UTC =
   7 p. m. del día anterior en Bogotá. */
describe('meta del mes: los días del mes van a las 05:00Z', () => {
  it('medianoche UTC del 30 es el 29 en Bogotá; las 05:00Z del 30 es el 30', () => {
    expect(inicioDia(new Date(Date.UTC(2026, 10, 30, 0))).toISOString()).toBe('2026-11-29T05:00:00.000Z')
    expect(inicioDia(new Date(Date.UTC(2026, 10, 30, 5))).toISOString()).toBe('2026-11-30T05:00:00.000Z')
  })

  for (const f of ['app/api/dashboard/analiticas/route.js', 'app/api/dashboard/analiticas/reporte-pdf/route.js']) {
    it(`${f} arma los días con Date.UTC(…, HORA_CORTE)`, () => {
      const src = readFileSync(f, 'utf8')
      expect(src).toMatch(/diasDelMes\.push\(new Date\(Date\.UTC\(hoy\.getFullYear\(\), hoy\.getMonth\(\), d, HORA_CORTE\)\)\)/)
      expect(src).not.toMatch(/diasDelMes\.push\(new Date\(hoy\.getFullYear\(\)/)
    })
  }
})
