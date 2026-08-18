// lib/__tests__/cazador-de-errores.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// 25 «Minified React error #300» en producción, y la pila que mandábamos era
// ésta:  at l7 (…/4bd1b696-…js) · at l9 (…) · at o_ (…)
// Las tripas de React. Ni un nombre nuestro.
//
// `CazadorDeErrores` se escribió el 16 de agosto para arreglarlo, y su commit
// decía «a comprobar contra un build de producción». Esa comprobación **no se
// había hecho**, y era la que importaba: en producción los nombres van
// minificados, así que el árbol podía llegar tan mudo como la pila.
//
// Comprobado el 18 ago haciendo reventar un componente a propósito contra un
// build de producción:
//
//   · el cazador SÍ manda su aviso, con árbol y `origen: 'cazador'`
//   · el árbol trae NUESTRO trozo y el byte exacto —«page-…js:1:27459»—
//   · cortando ahí aparece el componente entero, letra por letra
//
// O sea que sirve. Es la diferencia entre «no se puede reproducir» y «es éste».

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const cazador = leer('components/armazon/CazadorDeErrores.jsx')

describe('⚠ el cazador apunta quién fue antes de dejar pasar el error', () => {
  it('no relanza en el mismo render', () => {
    /* Relanzando ahí, React da la barrera por fallida y `componentDidCatch` NO
       LLEGA A CORRER — que es el único sitio donde está el árbol. */
    expect(cazador).toMatch(/static getDerivedStateFromError\(\) \{\s*return \{ callado: true \}/)
  })

  it('el árbol se manda desde `componentDidCatch`', () => {
    expect(cazador).toMatch(/componentDidCatch\(error, info\)/)
    expect(cazador).toMatch(/info\?\.componentStack/)
  })

  it('y se marca de dónde viene', () => {
    /* Sin `origen`, el aviso del cazador y el de la pantalla de error se
       confunden: los dos llegan por el mismo camino, y midiendo el último creí
       que el cazador no servía. */
    expect(cazador).toMatch(/origen: 'cazador'/)
  })

  it('relanza después, para que la pantalla de error siga siendo una sola', () => {
    /* Si pintara su propio mensaje habría DOS pantallas de error distintas
       según por dónde reventara. */
    expect(cazador).toMatch(/if \(this\.state\.error\) throw this\.state\.error/)
  })

  it('sale aunque la pantalla se esté cerrando', () => {
    expect(cazador).toMatch(/keepalive: true/)
  })
})

describe('⚠ y el árbol minificado se puede traducir', () => {
  const guion = leer('scripts/quien-reventó.mjs')

  it('hay guion para hacerlo', () => {
    expect(guion).toMatch(/componentStack/)
  })

  it('⚠ no usa glob para encontrar el trozo', () => {
    /* Las carpetas de Next llevan corchetes —`[id]`— y paréntesis
       —`(dashboard)`—, que para un patrón de glob son sintaxis. */
    /* ⚠ Se busca la LLAMADA, no la palabra: `globSync` aparece en el comentario
       que explica por qué no se usa, y mi primera versión falló por eso —una
       prueba en rojo con el código bien puesto. */
    expect(guion, 'volvió el glob y no encontrará los trozos').not.toMatch(/globSync\(/)
    expect(guion).toMatch(/readdirSync/)
  })

  it('y el patrón aguanta los paréntesis de la URL', () => {
    /* Un `[^)]*` corta el marco a la mitad: los paréntesis de `(dashboard)`
       están DENTRO de la dirección. */
    expect(guion).not.toMatch(/\[\^\)\]\*\?\(\[/)
  })
})
