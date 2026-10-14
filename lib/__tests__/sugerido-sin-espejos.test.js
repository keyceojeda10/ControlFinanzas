/* El capital sugerido no suma el espejo de un préstamo o pago que ya no cuenta.
 * Soporte de Oscar Oyola (14 oct 2026): borró y volvió a crear dos préstamos y
 * el sugerido le inventó $9.000.000. Ver lib/dinero/sugerido.js. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esEspejoDeRegistro } from '@/lib/dinero/sugerido'

describe('el capital sugerido no inventa plata', () => {
  it('reconoce los espejos que escribe el propio sistema', () => {
    for (const d of [
      'Reverso desembolso - préstamo eliminado (Patricia arboleda)',
      'Reverso desembolso - edición préstamo (anterior $1.000.000)',
      'Reverso recaudo - préstamo eliminado (Ana)',
      'Reverso pago anulado - préstamo de Ana',
      'Cancelación préstamo - devuelve todo a caja (OMAR)',
      'Cancelación préstamo - devuelve solo pendiente (Ana)',
    ]) expect(esEspejoDeRegistro(d)).toBe(true)
  })
  it('los ajustes de la persona sí cuentan', () => {
    for (const d of ['Deshecho: Retiro manual desde caja', 'Ajuste de caja manual (salida)', 'cuadre de caja', null, ''])
      expect(esEspejoDeRegistro(d)).toBe(false)
  })
  it('el resumen de capital los salta al reconstruir la caja', () => {
    const r = readFileSync('app/api/capital/resumen/route.js', 'utf8')
    expect(r).toMatch(/if \(mov\.tipo === 'ajuste'\) \{\n\s+\/\/ .*\n\s+if \(esEspejoDeRegistro\(mov\.descripcion\)\) return acc/)
  })
  it('el caso de Oscar: 87M inicial, cartera vieja, borra y recrea 9M → el sugerido es 0, no 9M', () => {
    // Manuales: +87.000.000 inicial, −2.581.000 retiro, +500.000/−500.000, y los dos espejos (+9.000.000).
    const ajustes = [
      { d: 'Reverso desembolso - préstamo eliminado (Patricia)', v: 5000000 },
      { d: 'Reverso desembolso - préstamo eliminado (Cardona)', v: 4000000 },
      { d: null, v: 500000 }, { d: null, v: -500000 },
    ]
    const base = 87000000 - 2581000 + ajustes.filter((a) => !esEspejoDeRegistro(a.d)).reduce((s, a) => s + a.v, 0)
    const prestado = 84419000 // los préstamos que existen, Patricia y Cardona una sola vez
    expect(base + 0 - prestado - 0).toBe(0)
  })
})
