import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// En escritorio salían A LA VEZ la barra lateral, la cabecera móvil y la
// pastilla: tres barras de navegación en la misma pantalla. Ninguno de los tres
// componentes tenía guardia de tamaño — los escribí con estilos en línea, que
// no admiten media queries, y nunca los vi juntos hasta que la app arrancó.
//
// El detalle que hace falta recordar: `display` en el estilo en línea LE GANA a
// la clase `hidden`. Si vuelve al style de la barra lateral, saldrá también en
// el teléfono, encima de la pastilla.

const leer = (p) => fs.readFileSync(path.join(process.cwd(), p), 'utf8')
const cabecera = leer('components/armazon/CabeceraMovil.jsx')
const pastilla = leer('components/armazon/PastillaNav.jsx')
const lateral = leer('components/armazon/BarraLateral.jsx')

describe('armazón · cada pieza en su tamaño', () => {
  it('las tres variantes de cabecera se ocultan en escritorio', () => {
    const cabeceras = [...cabecera.matchAll(/<header([^>]*)>/g)].map((m) => m[1])
    expect(cabeceras.length).toBeGreaterThanOrEqual(3)
    for (const attrs of cabeceras) expect(attrs).toContain('lg:hidden')
  })

  it('la pastilla se oculta en escritorio', () => {
    expect(pastilla).toContain('lg:hidden')
  })

  it('la barra lateral se oculta en móvil', () => {
    /* Puede llevar más clases detrás —`cf-no-print` desde el 25 ago— pero el
       display sigue yendo en la CLASE y no en línea, que es lo que cuida esta
       prueba: en línea le gana a `hidden` y la barra sale también en el móvil. */
    expect(lateral).toMatch(/className="hidden lg:flex(?: [^"]*)?"/)
  })

  // ESTE ES EL QUE FALLA SI ALGUIEN LO REVIERTE, y falló una vez: arreglé la
  // barra lateral, documenté la trampa, y dejé el mismo display en línea en la
  // cabecera y en la pastilla. Las dos siguieron saliendo en escritorio.
  it('ninguna de las tres lleva display en el estilo en línea', () => {
    const raizLateral = lateral.slice(lateral.indexOf('<aside'), lateral.indexOf('}}>'))
    expect(raizLateral, 'barra lateral').not.toMatch(/display:\s*'flex'/)

    const baseCabecera = cabecera.slice(cabecera.indexOf('const base = {'), cabecera.indexOf('position:'))
    expect(baseCabecera, 'cabecera').not.toMatch(/display:\s*'flex'/)

    const raizPastilla = pastilla.slice(pastilla.indexOf('<nav'), pastilla.indexOf('zIndex'))
    expect(raizPastilla, 'pastilla').not.toMatch(/display:\s*'flex'/)
  })

  it('cabecera y pastilla declaran su display en la clase', () => {
    // Sin `flex` en la clase quedan como `display:block` en móvil.
    expect(cabecera).toMatch(/className="flex lg:hidden(?: [^"]*)?"/)
    expect(pastilla).toMatch(/className="flex lg:hidden(?: [^"]*)?"/)
  })
})

describe('marca · el logo es el oficial', () => {
  it('cabecera y barra lateral usan /logo-icon.svg', () => {
    // Antes iba un "$" dibujado a mano, que no es la marca de nadie.
    expect(cabecera).toContain('/logo-icon.svg')
    expect(lateral).toContain('/logo-icon.svg')
  })

  it('ya no queda el glifo inventado', () => {
    expect(cabecera).not.toMatch(/>\$<\/span>/)
    expect(lateral).not.toMatch(/>\$<\/span>/)
  })
})
