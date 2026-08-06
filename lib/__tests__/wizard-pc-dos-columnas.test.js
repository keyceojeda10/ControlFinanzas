import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// ── T16-00 · EN ESCRITORIO NO HAY WIZARD ───────────────────────────────────
//
// La lámina: «Sin wizard: los tres pasos caben en una pantalla y el panel
// derecho se recalcula al escribir. Subir el interés de 20 a 25 mueve la cuota,
// la ganancia y las ocho filas mientras se decide — que es exactamente lo que
// el dueño hace hoy con una calculadora al lado.»
//
// Medido antes de tocar nada, a 1440px: el paso de condiciones pedía 2.654px de
// alto en una ventana de 950 —2,8 pantallas de scroll para SIETE campos— y cada
// tarjeta de frecuencia ocupaba 672px de ancho para tres palabras.

const RAIZ = process.cwd()
const crudo = readFileSync(
  resolve(RAIZ, 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8')

/* ⚠ SIN COMENTARIOS. Los comentarios de esta pantalla CITAN los fallos que
   explican —«escribí `f.cuota` y no existe»—, así que una prueba que busque
   `f.cuota` en el texto crudo se caza a sí misma. Van tres veces hoy con este
   mismo patrón. Se vacían en vez de borrarse para no correr los números. */
const src = crudo
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
  .split('\n').map((l) => (/^\s*(\/\/|\*)/.test(l) ? '' : l)).join('\n')

describe('las dos columnas', () => {
  it('la caja se ensancha solo en escritorio', () => {
    // En móvil tiene que seguir siendo la columna de 672px de siempre.
    expect(src).toMatch(/max-w-2xl xl:max-w-\[1076px\]/)
  })

  it('el panel es una columna de la rejilla, no algo flotando', () => {
    /* Era `position: fixed` colgado del borde derecho: un atajo para no tocar
       los tres pasos. Se montaba encima de la pastilla «Repetir anterior», que
       salía cortada a media palabra. */
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    const clases = panel.slice(0, 260)
    expect(clases, 'el panel volvió a ser `fixed` y va a tapar cosas otra vez')
      .not.toMatch(/\bfixed\b/)
    expect(clases, 'sin `sticky` el panel se va de la vista al bajar')
      .toMatch(/sticky/)
    expect(src).toMatch(/xl:grid-cols-\[minmax\(0,672px\)_380px\]/)
  })

  it('y no se pinta en el teléfono', () => {
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    expect(panel.slice(0, 260)).toMatch(/hidden xl:block/)
  })
})

describe('la cuota no sale dos veces', () => {
  it('la franja de abajo se calla cuando el panel la muestra', () => {
    /* El panel la enseña a 32px arriba a la derecha. Dejarla también en la
       franja ponía la misma cifra dos veces en la misma pantalla. */
    const i = src.indexOf("{paso === 1 && calculo && (")
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 200)).toMatch(/xl:hidden/)
  })
})

describe('el calendario del panel', () => {
  it('la cabecera y las filas usan LA MISMA constante de columnas', () => {
    /* Las escribí por separado y quedaron en 52px y 46px. En el JSX las dos
       rejillas se leen idénticas; el descuadre solo se ve midiendo el DOM. */
    expect(src).toMatch(/const COLUMNAS_CALENDARIO = /)
    const usos = (src.match(/gridTemplateColumns: COLUMNAS_CALENDARIO/g) ?? []).length
    expect(usos, 'la cabecera y las filas tienen que salir de la misma constante').toBe(2)

    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    expect(panel, 'volvió a haber una medida de columnas escrita a mano')
      .not.toMatch(/gridTemplateColumns: '[\d\w ]+px/)
  })

  it('lee los campos que `lib/calculos.js` produce de verdad', () => {
    /* Escribí `f.cuota` de memoria: no existe. Habría pintado una columna de
       ceros sin que nada fallara — ni el build ni las pruebas lo verían. */
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    const calculos = readFileSync(resolve(RAIZ, 'lib/dinero/../calculos.js'), 'utf8')
    for (const campo of ['cuotaTotal', 'saldoRestante', 'fechaEsperada']) {
      expect(panel, `el panel no usa ${campo}`).toContain(`f.${campo}`)
      expect(calculos, `${campo} no existe en calculos.js`).toContain(`${campo}:`)
    }
    expect(panel, '`f.cuota` no existe; el campo es `cuotaTotal`')
      .not.toMatch(/f\.cuota\b(?!Total)/)
  })

  it('sale entero, no recortado a las primeras filas', () => {
    // La versión flotante cortaba a 6 porque no tenía altura conocida. Ahora el
    // panel tiene su propio scroll y da igual que sean 8 cobros o 90.
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    expect(panel).toMatch(/calculo\.tablaAmortizacion\.map\(/)
    expect(panel, 'volvió el recorte a las primeras filas')
      .not.toMatch(/tablaAmortizacion\.slice\(0, \d/)
    expect(panel, 'sin scroll propio, un préstamo de 90 cobros se sale de la pantalla')
      .toMatch(/overflow-y-auto/)
  })
})

describe('las fechas del calendario', () => {
  it('se formatean en UTC', () => {
    /* `lib/dinero/calendario.js` calcula las fechas de cobro entera y
       deliberadamente en UTC. Formatearlas con la zona del navegador las corre
       un día para cualquiera al oeste de UTC-5 — Costa Rica es UTC-6 y sí
       tenemos ahí. */
    const i = src.indexOf('const fechaCorta')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 400)).toMatch(/timeZone: 'UTC'/)
  })
})

describe('la frecuencia deja de comerse la pantalla', () => {
  it('va en dos columnas desde tablet', () => {
    // Cuatro tarjetas de 672px de ancho para tres palabras, apiladas, sumaban
    // 340px de alto ellas solas.
    const i = src.indexOf('FRECUENCIAS.map')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i - 400, i)).toMatch(/grid-cols-1 sm:grid-cols-2/)
  })
})
