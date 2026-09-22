// lib/__tests__/hover-no-queda-encendido.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El 31 ago 2026 el botón de editar fecha salía con un recuadro azul encendido
// en las CATORCE tarjetas de pago. No era de esa pantalla: `globals.css` pasa los
// colores del tema oscuro al claro con reglas `[class*="bg-[rgba(59,130,246"]`, y
// `*=` casa por SUBCADENA. `hover:bg-[rgba(59,130,246,0.08)]` contiene esa
// subcadena, así que el `!important` pintaba el fondo de hover SIEMPRE, hubiera
// puntero encima o no. Eran 50 fondos y 4 bordes (`hover:`, `focus:`).
//
// La cura es la misma que ya tenía `rounded-[1`: casar la clase al PRINCIPIO del
// atributo (`^=`) o tras un ESPACIO (`*=" …"`). Las variantes van tras «:» y
// quedan fuera.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8')

describe('las reglas del tema claro no encienden los hover', () => {
  it('ningún fondo ni borde rgba se casa por subcadena suelta', () => {
    const sueltas = css.match(/\[class\*="(?:bg|border)-\[rgba\([^"]*"\]/g) ?? []
    expect(sueltas, `estas reglas casarían también hover:/focus: y los dejarían encendidos:\n  ${sueltas.join('\n  ')}`).toHaveLength(0)
  })

  it('siguen existiendo, ancladas al principio o tras un espacio', () => {
    expect(css).toMatch(/\[class\^="bg-\[rgba\(59,130,246"\], html\[data-theme="light"\] \[class\*=" bg-\[rgba\(59,130,246"\]/)
    expect(css).toMatch(/\[class\^="border-\[rgba\(239,68,68"\], html\[data-theme="light"\] \[class\*=" border-\[rgba\(239,68,68"\]/)
  })

  it('una clase base casa y su variante hover NO', () => {
    // Lo que hace el navegador con `^=` y `*=`, sobre el atributo `class` entero.
    const casa = (clases, tok) => clases.startsWith(tok) || clases.includes(` ${tok}`)
    const tok = 'bg-[rgba(59,130,246'
    expect(casa('px-2 bg-[rgba(59,130,246,0.1)] rounded-[8px]', tok)).toBe(true)
    expect(casa('bg-[rgba(59,130,246,0.1)]', tok)).toBe(true)
    expect(casa('px-2 hover:bg-[rgba(59,130,246,0.08)]', tok)).toBe(false)
    expect(casa('px-2 focus:bg-[rgba(59,130,246,0.08)]', tok)).toBe(false)
  })
})
