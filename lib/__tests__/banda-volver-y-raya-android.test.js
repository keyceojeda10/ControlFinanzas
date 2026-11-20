// 20 nov 2026: «el circulito [de volver] sale un poquito cortado arriba» y «el fondo en
// Android sale cortado con una línea en la mitad». Anclado en código, no en comentarios.
import { describe, it, expect } from 'vitest'
import fs from 'fs'

const cab = fs.readFileSync('components/armazon/CabeceraInicio.jsx', 'utf8')
const vistas = fs.readFileSync('components/prestamos/PrestamoDetalleViews.jsx', 'utf8')

describe('la banda negra de los detalles', () => {
  it('la fila del botón de volver arranca debajo de la tira fija del iPhone', () => {
    const alto = Number(cab.match(/const ALTO_TINTA = (\d+)/)[1])
    // Las dos bandas de detalle (CabeceraDetalle y BandaDetalleArmazon).
    const filas = cab.match(/padding: `max\(\$\{ALTO_TINTA \+ (\d+)\}px, env\(safe-area-inset-top\)\) 8px 0 8px`/g) || []
    expect(filas.length).toBe(2)
    expect(cab).not.toMatch(/padding: 'max\((\d+)px, env\(safe-area-inset-top\)\) 8px 0 8px'/)
    for (const f of filas) expect(Number(f.match(/\+ (\d+)/)[1])).toBeGreaterThan(0)
    expect(alto).toBeGreaterThan(10) // Safari no toma el color con 10 o menos
  })

  it('llamar, WhatsApp y las pastillas llevan su propia capa (fallo Mali)', () => {
    expect(vistas).toMatch(/aria-label="Llamar" className="cf-cab-toque"/)
    expect(vistas).toMatch(/aria-label="WhatsApp" className="cf-cab-toque"/)
    expect(vistas).toMatch(/<span key=\{key\} className="cf-num cf-cab-chip" style=/)
    expect(cab).toMatch(/\.cf-cab-toque, \.cf-cab-circulo, \.cf-cab-chip \{ transform: translateZ\(0\)/)
  })
})
