import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (...p) => readFileSync(join(process.cwd(), ...p), 'utf8')

// Toda barra `fixed` que llegue hasta abajo tiene que empezar donde ACABA el
// menú lateral de escritorio. Si empieza antes, se mete por debajo; si además
// lleva sombra —todas la llevan—, esa sombra se derrama sobre el menú y se ve
// como una franja gris. Reportado en producción con una flecha señalándola.
const BARRAS = [
  ['crear préstamo', ['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx']],
  ['crear cliente',  ['components', 'clientes', 'ClienteForm.jsx']],
]

describe('las barras fijas empiezan donde acaba el menú', () => {
  it('el menú declara su ancho en un token', () => {
    // Si el token desapareciera, `lg:left-[var(--cf-w-sidebar)]` se resolvería
    // a nada y las barras se pegarían al borde en escritorio.
    expect(leer('app', 'tokens-2026.css')).toMatch(/--cf-w-sidebar:\s*\d+px/)
    expect(leer('components', 'armazon', 'BarraLateral.jsx')).toContain('var(--cf-w-sidebar)')
  })

  for (const [nombre, ruta] of BARRAS) {
    it(`${nombre} usa el token, no un número clavado`, () => {
      const src = leer(...ruta)
      const fijas = src.match(/className="[^"]*\bfixed\b[^"]*\bbottom-0\b[^"]*"/g) || []
      expect(fijas.length, 'no encuentro la barra de acciones').toBeGreaterThan(0)
      for (const clase of fijas) {
        expect(clase, `${nombre}: barra pegada al borde en escritorio`)
          .toContain('lg:left-[var(--cf-w-sidebar)]')
      }
    })

    it(`${nombre} no deja ningún left-60 suelto`, () => {
      // 240px de Tailwind contra 250px del menú: 10px de franja gris. Vale para
      // CUALQUIER barra fija del archivo, no solo la de abajo — la de crear
      // préstamo tiene dos.
      const src = leer(...ruta)
      const sinComentarios = src
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
        .replace(/\/\*[\s\S]*?\*\//g, '')
      expect(sinComentarios).not.toMatch(/\blg:left-60\b/)
    })
  }

  it('ninguna pantalla del panel vuelve a clavar el ancho', () => {
    // La red de seguridad: que no reaparezca en una pantalla nueva.
    const sospechosas = [
      ['app', '(dashboard)', 'prestamos', 'nuevo', 'page.jsx'],
      ['components', 'clientes', 'ClienteForm.jsx'],
    ]
    for (const ruta of sospechosas) {
      const src = leer(...ruta).replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      expect(src, ruta.join('/')).not.toMatch(/lg:left-\[24\d?px\]/)
    }
  })
})
