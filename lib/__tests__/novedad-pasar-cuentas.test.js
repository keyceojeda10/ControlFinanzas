/* La novedad del 21 oct 2026: una sola vista, solo para el dueño. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NOVEDADES, novedadVigente } from '@/lib/novedades'

describe('novedad «Pasa plata entre tus cuentas»', () => {
  const LA_28 = NOVEDADES.find((n) => n.version === 28)
  it('tiene su versión y una sola tarjeta', () => {
    expect(LA_28).toMatchObject({ version: 28, fecha: '2026-10-21', soloDueno: true })
    expect(LA_28.items).toHaveLength(1)
    expect(LA_28.items[0].titulo).toBe('Pasa plata entre tus cuentas')
  })
  it('se abre el 21 y el 22 de octubre, no después', () => {
    expect(novedadVigente(LA_28, new Date('2026-10-22T02:00:00Z'))).toBe(true)
    expect(novedadVigente(LA_28, new Date('2026-10-23T04:59:00Z'))).toBe(true)
    expect(novedadVigente(LA_28, new Date('2026-10-23T05:00:00Z'))).toBe(false)
  })
  it('al cobrador no se le abre: se da por vista', () => {
    const m = readFileSync('components/layout/NovedadesModal.jsx', 'utf8')
    expect(m).toMatch(/if \(NOVEDADES\[0\]\?\.soloDueno && !esOwner\) \{\n\s+localStorage\.setItem\(LS_KEY, String\(NOVEDADES_VERSION\)\)\n\s+return/)
    expect(m).toContain('if (cargandoSesion) return')
  })
})
