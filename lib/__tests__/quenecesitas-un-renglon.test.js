// lib/__tests__/quenecesitas-un-renglon.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El comentario del propio componente decía «en reposo es una línea». Eran dos:
// la de los ejemplos solo se escondía cuando ya estabas escribiendo. Medido en
// la lista de clientes: ~83px por delante del título, y el texto partido en dos
// renglones a 412px de ancho.
//
// El dueño lo reportó con captura: «el buscador nuevo dentro de esa sección se
// ve terrible… o lo ubicamos mejor o lo quitamos de ahí».
//
// Lo que se prueba es la CONDUCTA —en reposo ocupa un renglón, y ese renglón
// mide lo mismo que el resto de controles de la app— no las clases exactas.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const caja = leer('components/acciones/QueNecesitas.jsx')

describe('en reposo es UN renglón', () => {
  it('⚠ los ejemplos no ocupan sitio hasta que se toca el campo', () => {
    // Antes: `{!buscando && ejemplos.length > 0 && …}` — o sea, siempre que no
    // estuvieras escribiendo. Ahora hace falta haber enfocado.
    expect(caja).toMatch(/enfocado && !buscando && ejemplos\.length > 0/)
  })

  it('y el foco se suelta con retraso, o el clic no llega', () => {
    /* Sin el retraso, el `blur` de tocar un resultado lo esconde antes de que
       el clic se dispare: la acción se ofrece y no se puede pulsar. */
    expect(caja).toMatch(/onBlur=\{\(\) => setTimeout\(/)
  })
})

describe('mide lo mismo que el resto de controles', () => {
  it('46 de alto, como el buscador de clientes y el conmutador de vista', () => {
    // `BuscadorLista` y `ConmutadorVista` son 46 los dos. Un control de 36 al
    // lado de ellos fue justo lo que el dueño vio mal en la fila de clientes.
    expect(caja).toMatch(/height: 46/)
    expect(leer('components/pantallas/ListaClientes.jsx')).toMatch(/height: 46/)
    expect(leer('components/pantallas/HojaFiltros.jsx')).toMatch(/height: 46/)
  })

  it('y usa el radio de control, no el de tarjeta', () => {
    expect(caja).toMatch(/--cf-r-control/)
    expect(caja).not.toMatch(/--cf-r-card/)
  })
})
