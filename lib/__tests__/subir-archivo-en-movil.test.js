// lib/__tests__/subir-archivo-en-movil.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «No me carga. El archivo para subirlo. No me deja seleccionarlo» — un cliente
// desde el móvil, 15 ago 2026. En su captura se ve el selector de Android con
// un archivo de Drive rotulado «Hoja de cálculo» que no responde.
//
// Son DOS fallos distintos y ninguno da error en pantalla:
//
//   1. El `accept` iba solo con extensiones. Android NO filtra por extensión:
//      el selector filtra por TIPO MIME. Lo que llega por WhatsApp suele
//      declararse `application/octet-stream` y muchos gestores marcan los CSV
//      como `text/plain`: el archivo bueno sale gris y no se puede tocar.
//
//   2. Una hoja NATIVA de Google no es un archivo con bytes. No hay `accept`
//      que la vuelva elegible — hay que decirlo en pantalla.
//
// Y buscándolo apareció un tercero, en el lector de fotos por tanda que ahora
// cuelga del arranque: el botón decía «Elegir las fotos» y el input llevaba
// `capture="environment"`, que en Android abre la CÁMARA y hace que el
// navegador ignore el `multiple`. Prometía «hasta 30 fotos de una vez» y daba
// una por vez.
//
// ⚠ Nada de esto se ve leyendo el código en el escritorio: `capture` y el
//   filtro MIME solo actúan en el teléfono.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { ACCEPT_TABLA, AVISO_HOJA_DE_GOOGLE } from '../archivos-tabla.js'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

describe('⚠ el selector del móvil filtra por MIME, no por extensión', () => {
  it('acepta los tipos que declaran los proveedores de verdad', () => {
    for (const t of [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
      // El de WhatsApp y el de los gestores que no saben qué mandan.
      'application/octet-stream',
      'text/plain',
    ]) expect(ACCEPT_TABLA, `falta ${t}`).toContain(t)
  })

  it('conserva las extensiones, que son las que filtran en el escritorio', () => {
    for (const e of ['.xlsx', '.xls', '.csv']) expect(ACCEPT_TABLA).toContain(e)
  })

  for (const f of [
    'components/onboarding/wizard/WizardExcel.jsx',
    'components/carga-masiva/PasoSubir.jsx',
  ]) {
    it(`${f} usa la lista compartida`, () => {
      const src = leer(f)
      expect(src, 'volvió al accept estrecho').not.toMatch(/accept="\.xlsx,\.xls,\.csv"/)
      expect(src).toMatch(/accept=\{ACCEPT_TABLA\}/)
    })

    it(`${f} avisa de las hojas de Google`, () => {
      // Lo que ningún `accept` puede arreglar tiene que estar dicho.
      expect(leer(f)).toMatch(/AVISO_HOJA_DE_GOOGLE/)
    })
  }

  it('el aviso dice qué hacer, no solo qué falla', () => {
    expect(AVISO_HOJA_DE_GOOGLE).toMatch(/Descargar/)
    expect(AVISO_HOJA_DE_GOOGLE).toMatch(/xlsx/)
  })
})

describe('⚠ «Elegir las fotos» no puede abrir la cámara', () => {
  const src = leer('components/migrador/LoteFotos.jsx')

  it('la entrada de la galería admite varias y NO fuerza la cámara', () => {
    /* Con `capture` puesto el navegador ignora el `multiple`: la promesa de
       «hasta 30 fotos de una vez» se cae, y quien ya fotografió el cuaderno no
       puede escoger nada. */
    const galeria = src.match(/<input ref=\{inputRef\}[^>]*>/gs) ?? []
    expect(galeria.length, 'no encontré la entrada de galería').toBeGreaterThan(0)
    for (const g of galeria) {
      expect(g, 'la galería volvió a forzar la cámara').not.toMatch(/capture=/)
      expect(g, 'la galería perdió el multiple').toMatch(/multiple/)
    }
  })

  it('la cámara sigue existiendo, en su propia entrada', () => {
    expect(src).toMatch(/<input ref=\{camaraRef\}[\s\S]*?capture="environment"/)
    expect(src).toMatch(/camaraRef\.current\?\.click\(\)/)
  })
})
