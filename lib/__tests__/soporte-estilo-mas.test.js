import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Soporte con el estilo de «Más» (18 nov 2026): era un botón dorado suelto, una
// tarjeta centrada para WhatsApp y otra vacía. Ahora, dos grupos de filas.
const src = readFileSync('app/(dashboard)/soporte/page.jsx', 'utf8')

describe('Soporte, en filas', () => {
  it('cómo pedir ayuda: WhatsApp primero, luego el ticket', () => {
    const i = src.indexOf('titulo="Escríbenos por WhatsApp"')
    const j = src.indexOf('titulo="Crear un ticket"')
    expect(i).toBeGreaterThan(-1)
    expect(j).toBeGreaterThan(i)
    expect(src).toMatch(/href="\/soporte\/nuevo"/)
  })
  it('las solicitudes dicen estado, tipo y fecha, y llevan a su ticket', () => {
    expect(src).toMatch(/href=\{`\/soporte\/\$\{t\.id\}`\}/)
    expect(src).toMatch(/fechaCortaDelInstante\(t\.createdAt, country\)/)
  })
  it('el vacío es un dato, no una tarjeta vacía', () => {
    expect(src).toMatch(/Todavía no has abierto ninguna\./)
  })
  it('sin dorado: el dorado es para la plata', () => {
    expect(src).not.toMatch(/<Button size="sm">/)
  })
})
