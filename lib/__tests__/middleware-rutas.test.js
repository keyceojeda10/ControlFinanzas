import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

// Este test existe porque 11 rutas del dashboard se abrían SIN SESIÓN.
//
// La causa no fue un descuido puntual: la lista de rutas privadas estaba
// escrita dos veces en el mismo archivo —el `if` y el `matcher`— y ninguna de
// las dos se actualizó al ir añadiendo pantallas. /capital, /gastos, /socios,
// /clavos, /cobros-hoy y seis más quedaron fuera.
//
// No se filtraban datos (las APIs sí validan sesión), pero la pantalla se
// abría. Y eso no se ve como un fallo de seguridad: se ve como una pantalla
// vacía.
//
// La comparación contra el disco es la parte que importa: fallará el día que
// alguien añada una pantalla y no toque el middleware.

const raiz = process.cwd()
const fuente = fs.readFileSync(path.join(raiz, 'middleware.js'), 'utf8')

function listaDe(nombre) {
  const i = fuente.indexOf(nombre)
  const abre = fuente.indexOf('[', i)
  const cierra = fuente.indexOf(']', abre)
  return [...fuente.slice(abre, cierra).matchAll(/'([^']+)'/g)].map((m) => m[1])
}

const privadas = listaDe('const RUTAS_PRIVADAS')
const matcher = listaDe('matcher:')

const enDisco = fs
  .readdirSync(path.join(raiz, 'app/(dashboard)'), { withFileTypes: true })
  .filter((d) => d.isDirectory() && fs.existsSync(path.join(raiz, 'app/(dashboard)', d.name, 'page.jsx')))
  .map((d) => '/' + d.name)
  .sort()

describe('middleware · ninguna pantalla del dashboard queda sin sesión', () => {
  it('RUTAS_PRIVADAS cubre todas las pantallas de app/(dashboard)', () => {
    const faltan = enDisco.filter((r) => !privadas.includes(r))
    expect(faltan, `sin proteger: ${faltan.join(', ')}`).toEqual([])
  })

  it('el matcher cubre todas las rutas privadas', () => {
    // Sin entrada en el matcher, el middleware NI SIQUIERA CORRE para esa ruta:
    // da igual lo que diga el `if`.
    const faltan = privadas.filter((r) => !matcher.includes(`${r}/:path*`) && !matcher.includes(r))
    expect(faltan, `fuera del matcher: ${faltan.join(', ')}`).toEqual([])
  })

  it('el guardia usa la constante y no una cadena de startsWith a mano', () => {
    // La cadena de `||` es lo que se desincronizó. Que no vuelva.
    expect(fuente).toContain('RUTAS_PRIVADAS.some((p) => pathname.startsWith(p))')
  })

  it('las APIs siguen cubiertas', () => {
    expect(matcher).toContain('/api/:path*')
  })
})
