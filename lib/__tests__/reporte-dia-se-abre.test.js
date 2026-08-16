// lib/__tests__/reporte-dia-se-abre.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «En el apartado de caja está ese botón que dice reporte, cuando le doy ahí
//  solamente aparece un selector de fecha y no hace más nada.»
//   — el dueño, 16 ago 2026, con la captura.
//
// Era literal. Tres condiciones se cerraban entre sí:
//
//   · el reporte solo se cargaba si `rutasSeleccionadas.length > 0`, y para un
//     dueño esa lista arranca VACÍA (el auto-seleccionar es solo del cobrador),
//   · las pastillas para elegir ruta solo se pintan con MÁS DE UNA ruta,
//   · y el botón «Generar reporte» solo salía si ya había rutas elegidas.
//
// Un dueño con una ruta o con ninguna no tenía por dónde entrar: ni pastilla
// que tocar, ni botón, ni carga automática.
//
// ⚠ Y no era un caso raro: **488 de 497 negocios tienen 0 o 1 ruta**, y 27 de
//   ellos pagan un plan que incluye este reporte. Solo 9 negocios tienen dos o
//   más rutas — o sea, la ruta feliz era la excepción.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'components/reportes/ReporteDia.jsx'), 'utf8')
const sinComentarios = src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('⚠ el reporte del día se abre solo', () => {
  it('la carga NO depende de que haya rutas elegidas', () => {
    /* Este era el nudo. Si vuelve la condición, el dueño con una sola ruta se
       queda otra vez mirando un selector de fecha. */
    expect(sinComentarios, 'volvió a exigir rutas para cargar')
      .not.toMatch(/if \(open && \(rutasSeleccionadas\.length > 0/)
    expect(sinComentarios).toMatch(/if \(open\) cargarReporte\(\)/)
  })

  it('el botón de generar no exige rutas ni ser dueño', () => {
    /* Queda como reintento, no como la única puerta. */
    expect(sinComentarios, 'el botón volvió a esconderse tras el rol y las rutas')
      .not.toMatch(/esOwner && rutasSeleccionadas\.length > 0 && !data/)
    expect(sinComentarios).toMatch(/\{!data && !loading && \(/)
  })

  it('tocar una ruta recarga sin volver a pulsar «Generar»', () => {
    // `cargarReporte` depende de las rutas, y el efecto depende de él.
    expect(sinComentarios).toMatch(/\}, \[fecha, rutasSeleccionadas\]\)/)
    expect(sinComentarios).toMatch(/\}, \[open, cargarReporte\]\)/)
  })
})

describe('sin filtro, el API trae todas las rutas', () => {
  const api = readFileSync(resolve(process.cwd(), 'app/api/reportes/dia/route.js'), 'utf8')

  it('el parámetro de rutas es opcional', () => {
    /* De esto depende que cargar sin selección sea lo correcto y no un vacío. */
    expect(api).toMatch(/const rutasParam = url\.searchParams\.get\('rutas'\)/)
    expect(api).toMatch(/if \(rutasParam\) \{/)
  })
})
