// lib/__tests__/editar-cliente-sin-cedula.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Entré a editar a un cliente, cambié la dirección, y me salió un error de
// cédula — y el campo de cédula no aparece por ningún lado».
//
// Tenía razón en las dos mitades:
//
//  1. Cuando un cliente se crea SIN documento —que es lo normal desde T07-03:
//     solo el nombre es obligatorio— se le guarda un marcador `SIN-m3k9x2ab`
//     para que la clave única `(organizationId, cedula)` siga funcionando.
//  2. Al editarlo, `ClienteForm` NO PINTA el campo (`sinCedula` es true) y
//     acuñaba un marcador NUEVO en cada guardado. El PATCH lo veía distinto
//     del guardado, lo tomaba por un cambio de cédula, se lo pasaba a
//     `validateDocument` y devolvía «Cédula no válido (ej: 1023456789)».
//
// El POST ya lo sabía (`esSinCedula`, en `app/api/clientes/route.js`). El PATCH
// no. O sea: se podían CREAR clientes sin cédula y después no se podían TOCAR.
//
// Medido contra producción: **1.574 de 6.012 clientes vivos (26%) en 86
// negocios**. Una cuarta parte de la cartera, bloqueada para editar.
//
// ── POR QUÉ SE ARREGLA EN LOS DOS SITIOS ─────────────────────────────────
//
// El formulario deja de acuñar el marcador, pero la PWA sirve el paquete viejo
// hasta que el navegador refresque: la mitad del API es la que lo corta hoy, y
// además cubre las ediciones que salen de la cola offline.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const RAIZ = process.cwd()
const leer = (r) => readFileSync(path.join(RAIZ, r), 'utf8')
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('el API deja editar a un cliente sin documento', () => {
  const api = sinNotas(leer('app/api/clientes/[id]/route.js'))

  it('reconoce el marcador «SIN-…»', () => {
    expect(api).toMatch(/esSinCedula/)
    expect(api).toMatch(/startsWith\('SIN-'\)/)
  })

  it('⚠ y NO lo pasa por el validador de documento', () => {
    /* Esta es la línea exacta que fallaba. Si vuelve a quedar
       `if (cedula && cedula.trim() !== clienteBase.cedula)` sin el marcador
       fuera, una cuarta parte de los clientes deja de poderse guardar y el
       error habla de un campo que la pantalla no muestra. */
    const guardia = api.match(/if \(cedula[\s\S]*?clienteBase\.cedula\)/)?.[0] ?? ''
    expect(guardia, 'la guardia del cambio de cédula ignora el marcador').toMatch(/!esSinCedula/)
  })

  it('no reescribe el marcador que el cliente ya tenía', () => {
    /* Sin esto la «cédula» del cliente cambiaba sola cada vez que alguien le
       tocaba la dirección: es una llave interna, no un dato suyo. */
    expect(api).toMatch(/conservaMarcador/)
    expect(api).toMatch(/cedula && !conservaMarcador/)
  })

  it('el POST sigue sabiéndolo (es de donde salió el patrón)', () => {
    const post = sinNotas(leer('app/api/clientes/route.js'))
    expect(post).toMatch(/esSinCedula/)
    expect(post).toMatch(/!esSinCedula && !validateDocument/)
  })
})

describe('el formulario conserva el marcador al editar', () => {
  const form = sinNotas(leer('components/clientes/ClienteForm.jsx'))

  it('al EDITAR reutiliza el marcador existente', () => {
    const bloque = form.slice(form.indexOf('const cedulaFinal'), form.indexOf('const payload'))
    expect(bloque).toMatch(/esEdicion && cedulaExistente\.startsWith\('SIN-'\)/)
    expect(bloque).toMatch(/cedulaExistente\s*$/m)
  })

  it('⚠ pero al CREAR sigue acuñando uno nuevo cada vez', () => {
    /* «Cargar otro cliente» reusa el mismo formulario sin recargar. Si aquí se
       reutilizara el marcador, el segundo cliente chocaría contra la clave
       única `(organizationId, cedula)` y el guardado reventaría con un 500. */
    const bloque = form.slice(form.indexOf('const cedulaFinal'), form.indexOf('const payload'))
    expect(bloque).toMatch(/`SIN-\$\{Date\.now\(\)/)
    expect(bloque).toMatch(/esEdicion &&/)
  })

  it('el campo sigue escondido cuando la cédula es un marcador', () => {
    /* Es lo correcto —enseñar «SIN-m3k9x2» sería peor— y es justo por lo que
       el error resultaba incomprensible. Que se quede escondido obliga a que
       nada de abajo pueda quejarse de él. */
    expect(form).toMatch(/useState\(cedulaExistente\.startsWith\('SIN-'\)\)/)
    expect(form).toMatch(/\{!sinCedula && \(/)
  })
})
