/* La novedad de la tarjeta del cliente: vence, es del dueño y dice cómo se usa. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { NOVEDADES, NOVEDADES_VERSION, novedadVigente } from '@/lib/novedades'

const n = NOVEDADES.find((x) => x.version === 29)
const texto = (titulo) => n.items[0].partes.find((p) => p.titulo === titulo)?.texto ?? ''

describe('novedad «La tarjeta del cliente»', () => {
  it('es solo del dueño y con una sola tarjeta', () => {
    expect(NOVEDADES_VERSION).toBeGreaterThanOrEqual(29)
    expect(n).toMatchObject({ version: 29, soloDueno: true })
    expect(n.items).toHaveLength(1)
    expect(n.items[0].titulo).toBe('La tarjeta del cliente')
  })
  it('⚠ vence: se abre hasta el 7 de noviembre, no después', () => {
    expect(novedadVigente(n, new Date('2026-11-06T00:30:00Z'))).toBe(true)
    expect(novedadVigente(n, new Date('2026-11-08T04:59:00Z'))).toBe(true)
    expect(novedadVigente(n, new Date('2026-11-08T05:00:00Z'))).toBe(false)
  })
  it('dice qué es, qué hace, cómo se activa y cómo se desactiva', () => {
    expect(n.items[0].partes.map((p) => p.titulo)).toEqual(['Qué es', 'Qué hace', 'Cómo se activa', 'Cómo se desactiva'])
  })
  it('⚠ las instrucciones nombran lo que de verdad dice la pantalla', () => {
    const config = readFileSync('app/(dashboard)/configuracion/page.jsx', 'utf8')
    for (const opcion of ['El comprobante con su tarjeta', 'Solo el comprobante', 'Nada']) {
      expect(config).toContain(`titulo: '${opcion}'`)
    }
    expect(config).toContain('>Qué recibe el cliente al pagar</span>')
    expect(config).toContain("label: 'Avisos por WhatsApp'")
    expect(texto('Cómo se activa')).toContain('«El comprobante con su tarjeta»')
    expect(texto('Cómo se activa')).toContain('Avisos por WhatsApp')
    expect(texto('Cómo se desactiva')).toContain('«Solo el comprobante» o «Nada»')
  })
  it('la hoja pinta las partes, y el modal se las pasa', () => {
    expect(readFileSync('components/layout/NovedadesModal.jsx', 'utf8')).toContain('partes: primera.partes')
    expect(readFileSync('components/pantallas/Cargando.jsx', 'utf8')).toContain('destacada.partes.map(')
  })
})
