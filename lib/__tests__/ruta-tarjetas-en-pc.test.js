// lib/__tests__/ruta-tarjetas-en-pc.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «En clientes y en préstamos se puede cambiar la vista de lista a tarjeta,
//  pero dentro de las rutas no tenemos esa opción, solamente sale lista. Y la
//  vista de tarjeta de móvil está mucho mejor construida, está más detallada,
//  tiene más opciones.» — el dueño, 22 ago 2026, con las dos capturas al lado.
//
// Lo que estas pruebas cuidan es la forma de romperlo que ya nos costó dos días
// con el comprobante: que alguien pinte AQUÍ una segunda tarjeta en vez de
// llamar a la que ya existe. Con dos tarjetas, arreglar una deja la otra igual.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

const ruta = leer('app/(dashboard)/rutas/[id]/page.jsx')
const escritorio = leer('components/pantallas/RutaEscritorio.jsx')

describe('la ruta en PC también se ve en tarjetas', () => {
  it('el escritorio ofrece las dos vistas', () => {
    expect(escritorio).toMatch(/valor: 'tabla'/)
    expect(escritorio).toMatch(/valor: 'tarjetas'/)
  })

  it('con el conmutador de siempre, no uno nuevo', () => {
    // Tres controles que hacen lo mismo con tres formas distintas es lo que
    // obliga a aprender la aplicación pantalla por pantalla.
    expect(escritorio).toMatch(/import \{ ConmutadorVista \} from '@\/components\/pantallas\/HojaFiltros'/)
  })

  it('la tabla deja su sitio a las tarjetas, no se pinta debajo', () => {
    expect(escritorio).toMatch(/vista === 'tarjetas' && tarjetas \? tarjetas : \(/)
  })

  it('⚠ y son LA MISMA tarjeta del teléfono: `renderCard`', () => {
    /* La prueba de verdad. Si alguien escribe una tarjeta aquí, esto sigue
       verde solo si además llama a `renderCard`, y entonces habría dos. */
    expect(ruta).toMatch(/tarjetas=\{\(/)
    expect(ruta).toMatch(/renderCard\(f, \{ actual: f\.id === idActual, sinArrastre: true \}\)/)
    // Una sola definición: dos serían dos tarjetas.
    expect((ruta.match(/const renderCard = /g) || []).length).toBe(1)
  })

  it('`renderCard` vive fuera de la rama de móvil, o el PC no la alcanza', () => {
    const iCard = ruta.indexOf('const renderCard = ')
    const iMovil = ruta.indexOf('className="lg:hidden"')
    expect(iCard).toBeGreaterThan(0)
    expect(iMovil).toBeGreaterThan(0)
    expect(iCard, 'volvió a quedar dentro de la vista de móvil').toBeLessThan(iMovil)
  })

  it('la preferencia de PC no le toca la del teléfono', () => {
    // Son dos vistas para dos pantallas: elegir tarjetas sentado no puede
    // cambiar nada en el teléfono, que es donde se cobra.
    expect(ruta).toMatch(/'cf-ruta-vista:pc'/)
  })

  it('en escritorio no se cuelga el arrastre, que es de dedo', () => {
    /* `arrastre.lista` es UN solo ref y las dos vistas están montadas a la vez:
       colgarlo también de las tarjetas de PC dejaría al móvil midiendo el nodo
       equivocado, sin error y solo en el teléfono. */
    expect(ruta).toMatch(/const g = sinArrastre \? \{\} : arrastre\.gestos\(i\)/)
  })

  it('las dos vistas enseñan a los mismos, no cada una a los suyos', () => {
    expect(ruta).toMatch(/const filasEscritorio = modoVista === 'auditoria' \? filas : filas\.filter\(\(f\) => f\.zona === 'hoy'\)/)
  })
})
