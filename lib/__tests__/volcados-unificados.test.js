// lib/__tests__/volcados-unificados.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Los reportes de bajar hay que unificarlos en los nuevos reportes que
//  hicimos, lo mismo: cada reporte con su pantalla individual, con sus filtros
//  y con sus dos formatos para bajar, PDF y Excel. Porque tendríamos lo mismo,
//  o sea, tendríamos reportes por todos lados, y la idea principal era unificar
//  todos los reportes.»  — el dueño, 16 ago 2026
//
// `/reportes/bajar` era la última pantalla fuera del sistema: cinco Excel que
// se bajaban a ciegas, sin poder mirarlos antes ni pedirlos en PDF.
//
// Lo que estas pruebas cuidan:
//
//   1. Que vuelva a aparecer una descarga fuera del índice. Es la queja
//      entera: «reportes por todos lados».
//   2. Que alguna de las cinco se pierda por el camino. Quitar una pantalla y
//      llevarse una función es el error que esta app ya cometió.
//   3. Que las columnas de la pantalla y las del Excel se separen. Salen de una
//      sola lista a propósito.

import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import { INFORMES } from '@/lib/reportes/catalogo'
import { COLUMNAS_CRUDAS, aFila, columnasDeDinero } from '@/lib/reportes/columnas-crudas'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const ids = INFORMES.map((i) => i.id)

describe('⚠ las cinco descargas de «bajar» son informes del índice', () => {
  /* Lo que ofrecía aquella pantalla, una por una. Si algún día se borra un
     informe de estos, aquí se ve: no se pierde en silencio. */
  const LAS_CINCO = [
    ['la cartera con lo que debe cada uno', 'cartera'],
    ['clientes', 'volcado-clientes'],
    ['pagos', 'volcado-pagos'],
    ['cobradores', 'volcado-cobradores'],
    ['todo en un Excel', 'crudo'],
  ]

  for (const [que, id] of LAS_CINCO) {
    it(`«${que}» tiene su informe`, () => {
      expect(ids, `se perdió al unificar: ${id}`).toContain(id)
    })
  }

  it('los cuatro nuevos se ven Y se bajan en los dos formatos', () => {
    /* Tener `ver` es lo que les da pantalla y los mete por el descargador, que
       es el que da PDF y Excel. Sin él serían otra vez un Excel a ciegas. */
    for (const id of ['cartera', 'volcado-clientes', 'volcado-pagos', 'volcado-cobradores']) {
      const informe = INFORMES.find((i) => i.id === id)
      expect(informe.ver, `«${informe.titulo}» no tiene pantalla`).toBeTruthy()
      expect(informe.ver).toMatch(/^\/api\/reportes\/datos\?tipo=/)
      expect(informe.formatoPropio, `«${informe.titulo}» no debe fijar formato: da los dos`).toBeUndefined()
    }
  })

  it('«Todo en bruto» se queda, y NO es un duplicado', () => {
    /* Entrega el libro de las cuatro hojas de una vez, que es lo que se le manda
       al contador. Los otros cuatro son una tabla cada uno. */
    const crudo = INFORMES.find((i) => i.id === 'crudo')
    expect(crudo.bajar).toContain('tipo=todo')
    expect(crudo.formatoPropio).toBe('excel')
  })
})

describe('⚠ no queda ninguna descarga fuera del índice', () => {
  it('la pantalla de reportes ya no lleva a `/reportes/bajar`', () => {
    const pantalla = leer('app/(dashboard)/reportes/page.jsx')
    expect(pantalla, 'volvió el botón a la pantalla vieja')
      .not.toMatch(/push\(['"]\/reportes\/bajar/)
  })

  it('y `/reportes/bajar` redirige, no da 404', () => {
    /* La gente tiene el enlace guardado: borrarla a secas los manda a una
       pantalla de error. */
    const ruta = 'app/(dashboard)/reportes/bajar/page.jsx'
    expect(existsSync(resolve(process.cwd(), ruta))).toBe(true)
    const src = leer(ruta)
    expect(src).toMatch(/redirect\('\/reportes'\)/)
    expect(src.length, 'sigue siendo la pantalla entera, no una redirección').toBeLessThan(1200)
  })
})

describe('⚠ el API con su propia consulta no rompe la de la pantalla', () => {
  it('se pega con & cuando `ver` ya trae un ?', () => {
    /* Los cuatro volcados comparten API y se distinguen por `?tipo=`. Pegar
       «?desde=…» detrás daba `datos?tipo=pagos?desde=…`, un segundo `?` que el
       servidor lee como parte del valor. La rama de descarga ya lo hacía bien y
       la de la pantalla no: el mismo fallo, en las dos vías. */
    const src = leer('app/(dashboard)/reportes/[informe]/page.jsx')
    expect(src).toMatch(/informe\.ver\.includes\('\?'\) \? '&' : '\?'/)
  })
})

describe('⚠ las columnas de la pantalla son las del Excel', () => {
  it('las cuatro tablas están declaradas en un solo sitio', () => {
    expect(Object.keys(COLUMNAS_CRUDAS).sort())
      .toEqual(['cartera', 'clientes', 'cobradores', 'pagos'])
  })

  it('el libro de Excel las toma de ahí, no de una lista suya', () => {
    const src = leer('lib/reportes/cuenta-completa.js')
    for (const c of ['COLS_CARTERA', 'COLS_CLIENTES', 'COLS_PAGOS', 'COLS_COBRADORES']) {
      expect(src, `la hoja de ${c} volvió a escribir sus encabezados`).toContain(`${c}.map((c) => c.rotulo)`)
    }
  })

  it('una fila de objeto se convierte en celdas en el orden de las columnas', () => {
    const cols = COLUMNAS_CRUDAS.clientes
    const fila = aFila({ nombre: 'Ana', debe: 300000 }, cols)
    expect(fila).toHaveLength(cols.length)
    expect(fila[0]).toBe('Ana')
    // Lo que no venga se escribe vacío, no `undefined` en la celda.
    expect(fila[1]).toBe('')
  })

  it('las columnas de dinero se sacan del tipo, no a mano', () => {
    /* Iban escritas como letras (`['G','H','I','Q']`) al lado de una lista de
       24 encabezados: insertar una columna las corría todas y el Excel dejaba
       de dar formato de moneda a la que tocaba. */
    const letras = columnasDeDinero(COLUMNAS_CRUDAS.clientes)
    const iDinero = COLUMNAS_CRUDAS.clientes.findIndex((c) => c.tipo === 'dinero')
    expect(letras).toEqual([String.fromCharCode(65 + iDinero)])
  })
})
