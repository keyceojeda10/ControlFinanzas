// lib/__tests__/panel-encuentra-las-de-casa.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Mi cuenta personal ccaojd@gmail.com está suspendida, pero no la encuentro en
//  la cuenta de superadmin para activarla.»          — el dueño, 1 sep 2026
//
// El panel le contestaba, con su cuenta existiendo y bloqueada por suscripción
// vencida:
//
//   «Nadie con eso · No encuentro «ccaojd@gmail.com» en nombre, dueño, correo
//    ni teléfono.»
//
// La consulta excluía las cuentas de casa ENTERAS —`users: { none: { email:
// { in: EMAILS_INTERNOS } } }`— y esa exclusión se aplicaba también a la
// búsqueda. Fuera de los conteos está bien: falsearían el MRR. Fuera del
// buscador no: es justo cuando hacen falta.
//
// ⚠ EL ARREGLO NO PUEDE MOVER LAS CIFRAS. El MRR, las pastillas y «negocios de
// verdad» tienen que salir igual que antes, con y sin búsqueda. Por eso las de
// casa se consultan APARTE y solo dentro del `if (busqueda)`.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const api = quitarComentarios(readFileSync(resolve(raiz, 'app/api/admin/usuarios/route.js'), 'utf8'))
const pantalla = quitarComentarios(readFileSync(resolve(raiz, 'app/admin/usuarios/page.jsx'), 'utf8'))

describe('⚠ buscar un correo entero encuentra hasta las cuentas de casa', () => {
  it('las internas se consultan, no se descartan', () => {
    expect(api).toMatch(/where: \{ users: \{ some: \{ email: \{ in: EMAILS_INTERNOS \} \} \} \}/)
  })

  it('y vienen marcadas', () => {
    /* Sin el rótulo, ver una cuenta de casa en la lista haría dudar de si los
       conteos de arriba la incluyen. */
    expect(api).toMatch(/esInterna: true/)
    expect(pantalla).toMatch(/u\.esInterna &&/)
    expect(pantalla).toMatch(/Cuenta de casa/)
  })
})

describe('⚠ y NO se cuelan en las cifras', () => {
  it('la consulta de los conteos sigue excluyéndolas', () => {
    expect(api).toMatch(/where: \{ users: \{ none: \{ email: \{ in: EMAILS_INTERNOS \} \} \} \}/)
  })

  it('el segmentador que da el MRR se llama ANTES de traerlas', () => {
    /* Ésta es la prueba que importa. Si algún día alguien sube la consulta de
       las internas por encima del `segmentarOrganizaciones` que produce `mrr`,
       `porSegmento` y `totalReal`, el MRR del panel se infla con las cuentas de
       casa y nadie se entera: la cifra sigue saliendo, solo que mal. */
    const conteos = api.indexOf('const { fichas, mrr, porSegmento, totalReal } = segmentarOrganizaciones(orgs)')
    const internas = api.indexOf('some: { email: { in: EMAILS_INTERNOS } }')
    expect(conteos).toBeGreaterThan(-1)
    expect(internas).toBeGreaterThan(-1)
    expect(internas).toBeGreaterThan(conteos)
  })

  it('y solo se traen cuando de verdad se está buscando algo', () => {
    /* Fuera del `if (busqueda)` aparecerían en la lista de todos los días. */
    const si = api.indexOf('if (busqueda) {')
    const internas = api.indexOf('some: { email: { in: EMAILS_INTERNOS } }')
    const cierre = api.indexOf('if (segmento && segmento !==')
    expect(si).toBeGreaterThan(-1)
    expect(internas).toBeGreaterThan(si)
    expect(internas).toBeLessThan(cierre)
  })
})
