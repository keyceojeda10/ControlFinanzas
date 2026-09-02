/* «Mi plata» y «Quién hizo qué» se fueron el 2 sep 2026. La pantalla decía
   «Capital» en su cabecera, la otra «Actividad», y el buscador «Historial»:
   tres nombres para lo mismo. El dueño: «en vez de entenderse fácilmente, se
   enreda mucho. Capital e historial. Ya está».

   Anclado en las CADENAS que se pintan, no en la prosa: los comentarios de
   este repo citan cómo se llamaba antes y eso no es un fallo. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const lee = (p) => readFileSync(p, 'utf8')
// Solo lo que se pinta: fuera comentarios de bloque y de línea.
const soloCodigo = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

const MENUS = {
  'components/pantallas/PantallaMas.jsx':  ["nombre: 'Capital'", "nombre: 'Historial'"],
  'components/armazon/BarraLateral.jsx':   ["nombre: 'Capital'", "nombre: 'Historial'"],
  'components/layout/Sidebar.jsx':         ["label: 'Capital'", "label: 'Historial'"],
  'components/layout/BottomNav.jsx':       ["label: 'Capital'", "label: 'Historial'"],
  'components/layout/GlobalSearch.jsx':    ["texto: 'Capital'"],
  'components/pantallas/MenuCrear.jsx':    ['nombre="Capital"'],
  'lib/searchCommands.js':                 ["label: 'Capital'", "label: 'Historial'"],
}

describe('Capital e Historial, con el mismo nombre en todas partes', () => {
  for (const [fichero, esperados] of Object.entries(MENUS)) {
    it(`${fichero} dice Capital/Historial y no los nombres viejos`, () => {
      const src = soloCodigo(lee(fichero))
      for (const e of esperados) expect(src, `falta ${e}`).toContain(e)
      expect(src, 'volvió «Mi plata»').not.toMatch(/['">]Mi plata['"<]/)
      expect(src, 'volvió «Quién hizo qué»').not.toMatch(/['">]Qui[eé]n hizo qu[eé]['"<]/)
    })
  }

  it('la cabecera de cada pantalla dice lo mismo que el menú', () => {
    expect(soloCodigo(lee('app/(dashboard)/capital/page.jsx'))).toMatch(/useCabecera\(\{ titulo: 'Capital'/)
    expect(soloCodigo(lee('app/(dashboard)/actividad/page.jsx'))).toMatch(/useCabecera\(\{ titulo: 'Historial'/)
  })

  it('quien aprendió los nombres viejos los sigue encontrando en el buscador', () => {
    const src = lee('lib/searchCommands.js')
    expect(src).toMatch(/'mi plata'/)
    expect(src).toMatch(/'quien hizo que'/)
  })

  it('DESIGN.md ya no manda «Mi plata»', () => {
    expect(lee('DESIGN.md')).not.toMatch(/\*Mi plata\* \(no "capital"\)/)
    expect(lee('DESIGN.md')).toMatch(/\*Capital\* e \*Historial\*/)
  })
})
