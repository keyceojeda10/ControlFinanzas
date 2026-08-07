import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── EL FIX DEL GLITCH MALI NO PUEDE PILLAR CLASES CON PREFIJO ──────────────
//
// `globals.css` pone `transform: translateZ(0)` en móvil a los elementos
// redondeados, para esquivar un fallo de rasterizado del driver Mali. El
// selector era:
//
//     [class*="rounded-[1"]
//
// que busca la subcadena en TODO el atributo `class`, así que también coincide
// con `lg:rounded-[16px]` — una clase que solo pinta en escritorio activando un
// `transform` que solo existe en móvil.
//
// Y un `transform`, aunque sea la identidad, convierte al elemento en el marco
// de referencia de cualquier `position: fixed` que lleve dentro. Así salía la
// barra de «Crear cliente»: 353px de ancho empezando en x=20, en una pantalla
// de 393 — flotando en medio en vez de apoyada en los bordes.
//
// Llevaba ahí escondido: la barra era del mismo color que el fondo y no se veía
// dónde empezaba. Se destapó al pasarla a blanco.

const RAIZ = process.cwd()
const css = readFileSync(resolve(RAIZ, 'app/globals.css'), 'utf8')

/** El bloque del fix, acotado a su `@media`.
 *
 * Se ancla en `.cf-hero-card`, que es lo único que identifica a ESTE bloque:
 * buscando `translateZ(0)` caía en otro `@media` distinto —hay más de uno— y
 * las pruebas hablaban de un css que no era. */
function bloqueMali() {
  const i = css.indexOf('.cf-hero-card,')
  expect(i, 'desapareció el fix del glitch Mali').toBeGreaterThan(-1)
  const ini = css.lastIndexOf('@media', i)
  return css.slice(ini, css.indexOf('}', css.indexOf('translateZ(0)', i)) + 1)
}

describe('el selector del fix Mali', () => {
  it('no coincide con clases prefijadas por breakpoint', () => {
    const b = bloqueMali()
    // `[class*="rounded-[1"]` a secas es el que pilla `lg:rounded-[16px]`.
    expect(b, 'volvió el selector que coincide con `lg:rounded-[…]`')
      .not.toMatch(/\[class\*="rounded-\[/)
  })

  it('sí sigue cubriendo las clases sin prefijo', () => {
    /* `rounded-[16px]` al principio del atributo o precedida de un espacio.
       Si esto se cae, vuelve el glitch de rasterizado en los Android con Mali,
       que se diagnosticó en vivo sobre un A13 real. */
    const b = bloqueMali()
    expect(b).toMatch(/\[class\^="rounded-\[1"\]/)
    expect(b).toMatch(/\[class\*=" rounded-\[1"\]/)
    expect(b).toMatch(/\[class\^="rounded-\[2"\]/)
    expect(b).toMatch(/\[class\*=" rounded-\[2"\]/)
  })

  it('y la clase explícita sigue en la lista', () => {
    // `.cf-hero-card` es el refuerzo para radios puestos por `style` inline,
    // que el selector de atributo no puede ver.
    expect(bloqueMali()).toMatch(/\.cf-hero-card/)
  })

  it('sigue aplicándose solo en móvil', () => {
    // En escritorio el fallo del driver no ocurre, y el `transform` de más
    // rompería cualquier `fixed` que quedara dentro.
    expect(bloqueMali()).toMatch(/@media \(max-width: 1023px\)/)
  })
})

describe('el campo del nombre no se sale de la fila', () => {
  const form = readFileSync(resolve(RAIZ, 'components/clientes/ClienteForm.jsx'), 'utf8')

  it('mide lo mismo que los demás campos', () => {
    /* Estaba a 68px contra los 56 del resto: «el input de nombre sale más
       grande que los demás». En crear préstamo el campo enorme funciona porque
       el monto ES la pantalla; aquí el nombre solo es el primero de una lista. */
    const i = form.indexOf('label="Nombre completo"')
    const campo = form.slice(i, i + 1600)
    expect(campo, 'volvió a llevar altura propia').not.toMatch(/h-\[\d+px\]/)
    // La letra sí se queda algo mayor, para que siga leyéndose como el principal.
    expect(campo).toMatch(/text-\[19px\]/)
  })

  it('pero conserva la clase que esquiva el 16px de iOS', () => {
    // Sin ella, pedir 19px da 16 por debajo de 1024 y el campo se iguala del
    // todo: el nombre dejaría de destacar por completo.
    const i = form.indexOf('label="Nombre completo"')
    expect(form.slice(i, i + 1600)).toMatch(/cf-campo-grande/)
  })
})
