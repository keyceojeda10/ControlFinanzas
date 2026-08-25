// lib/__tests__/guardar-y-pie-de-tabla.test.js
//
// Dos arreglos visuales reportados con captura el 14 ago 2026.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

describe('«Tus datos»: un solo botón de guardar', () => {
  /* «Esos botones de guardado están extraños y aparte hasta de tamaño diferente
     son.» Eran DOS en la misma tarjeta: «Guardar WhatsApp» pegado al teléfono y
     «Guardar nombre» cinco elementos más abajo, detrás del Rol —que ni siquiera
     se edita—. Y de tamaño distinto porque cada uno se ajustaba a su texto. */
  const src = leer('app/(dashboard)/configuracion/page.jsx')

  it('ya no hay dos guardados peleando en la misma tarjeta', () => {
    expect(src, 'volvió el botón que guardaba solo el teléfono').not.toMatch(/Guardar WhatsApp/)
    expect(src, 'volvió el botón que guardaba solo el nombre').not.toMatch(/Guardar nombre/)
    expect(src).toMatch(/Guardar cambios/)
  })

  it('guarda los dos campos en una sola llamada', () => {
    const fn = src.match(/const guardarDatos = async[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(fn, 'no se encontró el guardado unificado').toBeTruthy()
    expect(fn).toMatch(/JSON\.stringify\(\{ nombre, \.\.\.\(limpio && \{ telefono: limpio \}\) \}\)/)
  })

  it('⚠ el teléfono vacío no se manda', () => {
    /* Mandarlo como `null` hacía que el API lo convirtiera en cadena vacía y
       fallara su propia validación de longitud: respondía «Ingresa un número
       válido» a quien solo quería borrarlo. */
    const fn = src.match(/const guardarDatos = async[\s\S]*?\n  \}/)?.[0] ?? ''
    expect(fn, 'volvió el `telefono: null` que el API rechaza').not.toMatch(/telefono: limpio \|\| null/)
  })

  it('y ocupa todo el ancho, para que no dependa de su texto', () => {
    expect(src).toMatch(/onClick=\{guardarDatos\}[^>]*className="w-full"/)
  })

  it('no queda estado huérfano del botón que se fue', () => {
    expect(src).not.toMatch(/guardandoTel/)
    expect(src).not.toMatch(/msgTel/)
  })
})

describe('el pie de la tabla del préstamo', () => {
  /* «Los botones de Compartir tabla e Imprimir salen en una caja cuadrada que se
     ve rara.» `BarraAccion` es la barra FIJA del pie —fondo blanco, filete
     arriba, esquinas rectas— y está pensada para ir pegada al borde de la
     pantalla. Aquí el padre no le da altura, así que caía al final del contenido
     como un rectángulo suelto entre tarjetas redondeadas. */
  const src = leer('components/pantallas/TablaAmortizacion.jsx')

  it('ya no usa la barra fija del pie', () => {
    /* Lo que esta prueba cuida es la CAJA, no el componente. Desde el 25 ago
       la solución vive en el propio `BarraAccion` —`suelta` quita el fondo, el
       filete y las esquinas rectas— porque tenerla escrita a mano aquí hizo
       que el mismo fallo volviera a salir en el Simulador. */
    expect(src, 'volvió la caja blanca de esquinas rectas').not.toMatch(/<BarraAccion>/)
    expect(src).toMatch(/<BarraAccion suelta/)
  })

  it('los dos botones siguen ahí y siguen midiendo lo mismo', () => {
    expect(src).toMatch(/Compartir tabla/)
    expect(src).toMatch(/Imprimir/)
    expect((src.match(/<BotonSecundario style=\{\{ flex: 1 \}\}/g) ?? []).length).toBe(2)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 *  ⚠ LA CAJA CUADRADA, ARREGLADA EN EL PRIMITIVO Y NO EN LA PANTALLA
 *
 *  Tercer reporte del mismo rectángulo blanco: la tabla, socios y —25 ago
 *  2026, con la flecha roja pintada encima de la captura— el Simulador.
 *
 *  El fondo y el filete de `BarraAccion` solo tienen sentido cuando está
 *  PEGADA al pie. En toda pantalla montada con `sinMargen` el contenedor no
 *  tiene altura, así que la barra no se pega a nada y queda como una caja
 *  cuadrada en medio de una página de tarjetas redondeadas.
 *
 *  Las dos primeras veces se arregló A MANO, en la pantalla. Por eso volvió.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('⚠ la barra de acción sabe cuándo no se pega a nada', () => {
  const prim = leer('components/cf/primitivos.jsx')
  const sim = leer('components/pantallas/Simulador.jsx')

  it('`suelta` quita el fondo, el filete y las esquinas rectas', () => {
    const i = prim.indexOf('export function BarraAccion')
    expect(i).toBeGreaterThan(-1)
    const cuerpo = prim.slice(i, i + 500)
    expect(cuerpo).toMatch(/suelta = false/)
    expect(cuerpo).toMatch(/\.\.\.\(suelta \? \{ paddingTop: 4 \} : \{/)
    expect(cuerpo).toMatch(/background: 'var\(--cf-card\)'/)
    expect(cuerpo).toMatch(/borderTop: '1px solid/)
  })

  it('el Simulador la pide suelta cuando la pantalla fluye', () => {
    /* `sinMargen` es EXACTAMENTE la condición que la deja sin altura: el mismo
       ternario decide `height: auto` tres líneas más arriba. */
    expect(sim).toMatch(/<BarraAccion suelta=\{sinMargen\}>/)
    expect(sim).toMatch(/height: sinMargen \? 'auto' : '100%'/)
  })

  it('sin `suelta` la barra sigue siendo la de siempre', () => {
    /* Las pantallas que SÍ le dan altura no cambian: ahí el fondo separa la
       acción del contenido que pasa por debajo, que es para lo que está. */
    expect(leer('components/pantallas/CrearPrestamo.jsx')).toMatch(/<BarraAccion>/)
  })
})
