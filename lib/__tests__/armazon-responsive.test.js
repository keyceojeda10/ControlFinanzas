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
    expect(pastilla).toContain('className="lg:hidden"')
  })

  it('la barra lateral se oculta en móvil', () => {
    expect(lateral).toContain('className="hidden lg:flex"')
  })

  it('la barra lateral NO lleva display en el estilo en línea', () => {
    // Le ganaría a `hidden` y volveria a salir en el telefono.
    const raiz = lateral.slice(lateral.indexOf('<aside'), lateral.indexOf('}}>'))
    expect(raiz).not.toMatch(/display:\s*'flex'/)
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
