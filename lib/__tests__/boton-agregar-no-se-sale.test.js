// lib/__tests__/boton-agregar-no-se-sale.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Ese botón de "+ Agregar" en configuración, los medios de pago, se desfasa, o
// sea se sale de su sitio.» — el dueño, con captura, 14 ago 2026.
//
// Medido en el DOM a 372px de ancho, que es el de su captura:
//
//     ancho de la fila                  298px
//     lo que pedía  210 (campo) + 8 + 113 (botón) = 331px
//     → 33px de desborde, 16 de ellos por fuera de la tarjeta
//     alturas: campo 36px · botón 48px
//
// Dos causas sumadas:
//
//  1. El campo NO PUEDE ENCOGERSE. `min-width: auto` es el defecto de todo hijo
//     de un flex, y con los 16px de letra que `globals.css` fuerza a los inputs
//     en móvil —el anti-zoom de iOS— ese mínimo son 210px. El arreglo es
//     `min-w-0`, y no es cosmético: sin él la fila no cabe y algo tiene que
//     salirse.
//  2. `size="sm"` dejó de ser 36px. La escala quitó las alturas de 36 y 44 y
//     ahora el botón pequeño son 48; el campo se quedó con `h-9`.
//
// ⚠ En el JSX se ve una fila `flex gap-2` perfectamente normal. Esto solo
// aparece midiendo en el navegador, como el «BarraFiltros se sale de su caja».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const src = leer('components/pagos/MetodoPagoAdmin.jsx')
const campo = src.match(/<input[\s\S]*?\/>/)?.[0] ?? ''

describe('la fila de «+ Agregar» cabe en su tarjeta', () => {
  it('el campo puede encogerse', () => {
    expect(campo, 'no se encontró el campo').toBeTruthy()
    expect(campo, 'sin `min-w-0` la fila no cabe y el botón se sale').toMatch(/min-w-0/)
  })

  it('el campo y el botón miden lo mismo', () => {
    /* El botón es `size="sm"`, que hoy son 48px (`h-12`). Si mañana cambia la
       escala, este campo tiene que cambiar con ella. */
    expect(campo).toMatch(/\bh-12\b/)
    expect(campo, 'volvió la altura vieja, que ya no existe en la escala').not.toMatch(/\bh-9\b/)
    expect(leer('components/ui/Button.jsx')).toMatch(/sm: 'h-12/)
  })
})
