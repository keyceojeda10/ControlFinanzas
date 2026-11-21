// 21 nov 2026: el plan mensual renueva el mismo día del mes (Soluciones Díaz paga los 28).
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { sumarPeriodo } from '@/lib/mes-de-suscripcion'

// Las fechas se escriben como hora de Bogotá (−05:00), que es como se leen.
const b = (s) => new Date(`${s}-05:00`)
const bog = (d) => new Date(d.getTime() - 5 * 3600000).toISOString().slice(0, 16)

describe('un mes es un mes', () => {
  it('el 28 queda en 28 todo el año, a la misma hora', () => {
    let d = b('2026-11-28T18:59')
    const dias = []
    for (let i = 0; i < 14; i++) { d = sumarPeriodo(d, 'mensual'); dias.push(bog(d)) }
    expect(dias.every((x) => x.slice(8, 16) === '28T18:59')).toBe(true)
    expect(dias.slice(0, 4)).toEqual(['2026-12-28T18:59', '2027-01-28T18:59', '2027-02-28T18:59', '2027-03-28T18:59'])
  })
  it('de noche en Bogotá cuenta el día de Bogotá, no el de UTC', () => {
    // 22:30 del 28 en Bogotá son las 03:30 del 29 en UTC.
    expect(bog(sumarPeriodo(b('2027-01-28T22:30'), 'mensual'))).toBe('2027-02-28T22:30')
  })
  it('del 29 al 31 siguen los 30 días de antes (no se lleva a nadie al 28 de febrero)', () => {
    expect(bog(sumarPeriodo(b('2027-01-31T12:00'), 'mensual'))).toBe('2027-03-02T12:00')
    expect(bog(sumarPeriodo(b('2026-12-29T12:00'), 'mensual'))).toBe('2027-01-28T12:00')
  })
  it('trimestral, semestral y anual, sus días de siempre', () => {
    const d = b('2026-11-15T10:00')
    expect((sumarPeriodo(d, 'trimestral') - d) / 86400000).toBe(90)
    expect((sumarPeriodo(d, 'semestral') - d) / 86400000).toBe(180)
    expect((sumarPeriodo(d, 'anual') - d) / 86400000).toBe(365)
  })
  it('no toca la fecha que recibe', () => {
    const d = b('2026-11-28T18:59'); const t = d.getTime()
    sumarPeriodo(d, 'mensual')
    expect(d.getTime()).toBe(t)
  })
})

describe('las dos vías que renuevan usan la regla', () => {
  it('el pago (Wompi y cobro automático) y «asignar plan» del panel', () => {
    const activar = fs.readFileSync('lib/activar-suscripcion.js', 'utf8')
    expect(activar).toMatch(/const vencimiento = sumarPeriodo\(ahora, periodo\)/)
    expect(activar).toMatch(/const nuevaFecha = sumarPeriodo\(baseDate, periodo\)/)
    expect(activar).not.toMatch(/diasExtension/)
    const panel = fs.readFileSync('app/api/admin/organizaciones/[id]/route.js', 'utf8')
    expect(panel).toMatch(/const fechaVencimiento = sumarPeriodo\(/)
  })
})
