// UN DIBUJO POR COSA. El dueño, 20 sep 2026: «el sistema tiene varios iconos para
// clientes, varios para caja, varios para capital… hay que unificar todo, porque
// el cliente lo tiene en su memoria: busca por el icono».
import { describe, it, expect } from 'vitest'
import fs from 'fs'
const lee = (p) => fs.readFileSync(p, 'utf8')
const iconos = lee('components/armazon/iconos.jsx')

/** Los trazos de cada entrada de un mapa `clave: <>…</>,` del fichero. */
function entradas(nombreMapa) {
  const ini = iconos.indexOf(`export const ${nombreMapa} = {`)
  const fin = iconos.indexOf('\n}\n', ini)
  const cuerpo = iconos.slice(ini, fin)
  return [...cuerpo.matchAll(/^\s+'?([\w/-]+)'?:\s*(<>.*<\/>),?\s*$/gm)].map((m) => ({ clave: m[1], trazo: m[2] }))
}

describe('el juego de iconos del sistema', () => {
  const rutas = entradas('ICONO_DE_RUTA')
  const acciones = entradas('ICONO_DE_ACCION')

  it('se leen bien (si no, esta prueba no vigila nada)', () => {
    expect(rutas.length).toBeGreaterThan(20)
    expect(acciones.length).toBeGreaterThanOrEqual(4)
  })

  it('ningún dibujo sirve para dos cosas', () => {
    // Caja y Líneas de crédito eran la misma tarjeta; Cobrar hoy e Historial, el
    // mismo reloj; Clientes y Cobradores, las mismas dos personas.
    const vistos = new Map()
    for (const { clave, trazo } of [...rutas, ...acciones]) {
      expect(vistos.has(trazo), `«${clave}» usa el mismo dibujo que «${vistos.get(trazo)}»`).toBe(false)
      vistos.set(trazo, clave)
    }
  })

  it('los destinos que se confundían tienen ya su dibujo', () => {
    const de = Object.fromEntries(rutas.map((r) => [r.clave, r.trazo]))
    for (const r of ['/caja', '/capital', '/lineas-credito', '/cobros-hoy', '/actividad', '/clientes', '/cobradores', '/reportes', '/dashboard/analiticas', '/asistente', '/soporte']) {
      expect(de[r], `falta ${r}`).toBeTruthy()
    }
  })
})

describe('nadie más dibuja iconos de navegación por su cuenta', () => {
  it('la pastilla usa los del sistema', () => {
    const src = lee('components/armazon/PastillaNav.jsx')
    expect(src).toContain('const ICONOS = ICONO_DE_RUTA')
    expect(src).not.toMatch(/'\/clientes': \(/)
  })
  it('«Más» los pide por ruta', () => {
    const src = lee('components/pantallas/PantallaMas.jsx')
    expect(src).toMatch(/const I = Object\.fromEntries\(Object\.entries\(RUTA_DE\)/)
    expect(src).not.toMatch(/^\s+plata:\s+<>/m)
  })
  it('el menú del + también, y Lucas va ARRIBA de los grupos', () => {
    const src = lee('components/pantallas/MenuCrear.jsx')
    expect(src).toContain("import { Icono as IconoDelSistema } from '@/components/armazon/iconos'")
    expect(src).not.toMatch(/^const I = \{/m)
    // «está hasta abajo… hay que desplazar para verlo» — el dueño.
    expect(src.indexOf('>Pregúntale a Lucas</span>')).toBeGreaterThan(-1)
    expect(src.indexOf('>Pregúntale a Lucas</span>')).toBeLessThan(src.indexOf('{GRUPOS.map((g, n) => ('))
  })
  it('todas las claves que pide «Más» existen en el juego', () => {
    const mas = lee('components/pantallas/PantallaMas.jsx')
    const mapa = mas.slice(mas.indexOf('const RUTA_DE = {'), mas.indexOf('const I = Object.fromEntries'))
    const pedidas = [...mapa.matchAll(/: '(\/[\w/-]+)'/g)].map((m) => m[1])
    expect(pedidas.length).toBeGreaterThan(10)
    const hay = new Set(entradas('ICONO_DE_RUTA').map((r) => r.clave))
    for (const r of pedidas) expect(hay.has(r), `«Más» pide ${r} y no tiene icono`).toBe(true)
  })
})
