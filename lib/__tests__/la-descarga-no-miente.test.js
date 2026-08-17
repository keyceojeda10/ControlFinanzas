// lib/__tests__/la-descarga-no-miente.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Comprobando las doce descargas contra el espejo —las doce funcionan— salieron
// dos que sí estaban mal, y ninguna de las dos se ve leyendo el código:
//
//   1. «Todo en bruto» baja por su propia ruta y SIEMPRE devuelve un xlsx, pero
//      su botón decía «PDF» y el archivo se guardaba como `.pdf`. Un fichero
//      con extensión de PDF y contenido de hoja de cálculo no abre en NADA.
//   2. Pulsar «Excel» ponía «Armando…» también en el botón de PDF, porque la
//      condición miraba `bajando` a secas y no cuál se estaba armando.
//
// La regla que fijan estas pruebas: **lo que promete el botón y lo que dice la
// extensión tienen que salir de lo que de verdad llega**, nunca de lo que se
// pidió. Es el mismo fallo que la app ya tuvo con el comprobante y con la caja:
// dos sitios diciendo cosas distintas de la misma acción.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { INFORMES } from '@/lib/reportes/catalogo'

const PANTALLA = 'app/(dashboard)/reportes/[informe]/page.jsx'
const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ el botón dice lo que de verdad entrega', () => {
  const sinTraductor = INFORMES.filter((i) => !i.ver)

  it('hay informes que bajan por su propia ruta', () => {
    // Si esto llega a cero, el caso desapareció y la prueba deja de mirar nada.
    expect(sinTraductor.length).toBeGreaterThan(0)
  })

  for (const informe of sinTraductor) {
    it(`«${informe.titulo}» declara su formato`, () => {
      /* Sin declararlo, la pantalla asume PDF para todos: es lo que hacía que
         el volcado en bruto se bajara como un `.pdf` ilegible. */
      expect(informe.formatoPropio, `«${informe.titulo}» no dice qué formato entrega`)
        .toMatch(/^(pdf|excel)$/)
    })
  }

  it('«Todo en bruto» dice Excel, que es lo que da', () => {
    expect(INFORMES.find((i) => i.id === 'crudo')?.formatoPropio).toBe('excel')
  })

  it('«Listado de cobros» dice PDF, que es lo que da', () => {
    expect(INFORMES.find((i) => i.id === 'listado-cobros')?.formatoPropio).toBe('pdf')
  })

  it('los que pasan por el traductor NO lo declaran: dan los dos', () => {
    for (const i of INFORMES.filter((x) => x.ver)) {
      expect(i.formatoPropio, `«${i.titulo}» no debería fijar formato: baja en los dos`).toBeUndefined()
    }
  })
})

describe('⚠ la extensión sale de lo que llegó, no de lo que se pidió', () => {
  const src = leer(PANTALLA)

  it('se mira el tipo de la respuesta', () => {
    expect(src).toMatch(/res\.headers\.get\('content-type'\)/)
    expect(src).toMatch(/spreadsheet/)
  })

  it('ya no se decide la extensión solo por el botón', () => {
    expect(src, 'volvió a poner .pdf a todo lo que no fuera Excel')
      .not.toMatch(/a\.download = `\$\{informe\.id\}-\$\{periodo\}\.\$\{formato === 'excel' \? 'xlsx' : 'pdf'\}`/)
  })

  it('el botón principal usa el formato declarado', () => {
    expect(src).toMatch(/bajar\(informe\.formatoPropio \?\? 'pdf'\)/)
  })

  it('⚠ «Armando…» solo en el botón que se pulsó', () => {
    /* Con `bajando` a secas, pedir el Excel dejaba el botón de PDF diciendo que
       estaba armando algo que no estaba armando. */
    expect(src).toMatch(/bajando === \(informe\.formatoPropio \?\? 'pdf'\)/)
  })
})
