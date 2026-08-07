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
  it('va en una fila de cuatro, dos y dos en el teléfono', () => {
    /* Eran cuatro tarjetas de 672px de ancho para tres palabras, con su bolita
       de radio y una frase explicando qué es «semanal»: 340px de alto ellas
       solas. La lámina las pone como pastillas en una fila. */
    const i = src.indexOf('FRECUENCIAS.map')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i - 500, i)).toMatch(/grid-cols-2 sm:grid-cols-4/)
  })

  it('la elegida se marca en tinta, no en oro', () => {
    /* El oro es el color de la acción de seguir. Si además marca la frecuencia,
       el modo de interés y el atajo de monto, deja de señalar nada. */
    const i = src.indexOf('FRECUENCIAS.map')
    const bloque = src.slice(i, i + 900)
    expect(bloque).toMatch(/background: 'var\(--cf-ink\)'/)
  })

  it('la explicación se queda, pero solo la de la elegida', () => {
    // Quitarla del todo sería perder lo que distingue «quincenal» de «mensual»
    // para quien abre esto por primera vez.
    const i = src.indexOf('FRECUENCIAS.map')
    expect(src.slice(i, i + 1400)).toMatch(/Cobra cada dos semanas/)
  })
})

describe('el monto es el protagonista', () => {
  it('usa la variante grande de MoneyInput, no un input nuevo', () => {
    /* ⚠ Reemplazar `MoneyInput` por un `<input>` propio ya se llevó una vez el
       MODO ABREVIADO: el interruptor seguía encendido sin hacer nada y el
       cobrador creyó que se le había desactivado solo. */
    /* La ventana va holgada a propósito: `sinComentarios` VACÍA los comentarios
       pero mantiene su longitud —para no correr los números de línea—, así que
       entre una etiqueta y su campo puede haber 1.500 caracteres de espacios. */
    const i = src.indexOf('Monto del préstamo')
    const bloque = src.slice(i, i + 2500)
    expect(bloque).toMatch(/<MoneyInput/)
    expect(bloque).toMatch(/tamano="grande"/)
  })

  it('y la variante grande lleva la clase que esquiva el 16px de iOS', () => {
    /* `globals.css` fuerza `font-size:16px !important` a TODO input por debajo
       de 1024px. Sin `.cf-campo-grande`, pedir 34px da 16 y el campo sale MÁS
       PEQUEÑO que las cifras de al lado. En el código se ve bien. */
    const money = readFileSync(resolve(RAIZ, 'components/ui/MoneyInput.jsx'), 'utf8')
    const i = money.indexOf('grande: {')
    expect(i).toBeGreaterThan(-1)
    expect(money.slice(i, i + 260)).toMatch(/cf-campo-grande/)
  })

  it('el modo abreviado sigue entero', () => {
    const money = readFileSync(resolve(RAIZ, 'components/ui/MoneyInput.jsx'), 'utf8')
    for (const pieza of ['modoAbreviado', 'x1.000', 'Number(raw) * 1000']) {
      expect(money, `el rediseño se llevó ${pieza}`).toContain(pieza)
    }
  })

  it('los atajos se declaran UNA vez y se colocan en dos sitios', () => {
    // Dentro del campo cuando hay sitio, debajo cuando no. Escritos dos veces,
    // un día se cambia uno y el otro se queda como estaba.
    expect(src).toMatch(/const atajosDeMonto = /)
    expect((src.match(/atajosDeMonto/g) ?? []).length).toBe(3)
  })
})

describe('el interés y el plazo', () => {
  it('van uno al lado del otro', () => {
    const i = src.indexOf('Interés mensual')
    expect(src.slice(i - 300, i)).toMatch(/grid sm:grid-cols-2/)
  })

  it('el plazo se puede afinar de uno en uno', () => {
    const i = src.indexOf('Cuántas cuotas')
    const bloque = src.slice(i, i + 2500)
    expect(bloque).toMatch(/Una cuota más/)
    // Dentro de un formulario, un botón sin `type` envía.
    expect(bloque).toMatch(/type="button"/)
  })

  it('no baja de una cuota', () => {
    const i = src.indexOf('Cuántas cuotas')
    expect(src.slice(i, i + 2500)).toMatch(/Math\.max\(1,/)
  })
})

describe('el formulario descansa sobre papel', () => {
  it('la columna izquierda es una hoja en escritorio', () => {
    // «Las cajitas no tienen fondo, entonces se ve un poco extraño».
    const i = src.indexOf('xl:grid-cols-[minmax(0,672px)_380px]')
    expect(src.slice(i, i + 2000)).toMatch(/xl:bg-\[var\(--cf-card\)\]/)
  })

  it('pero no en el teléfono, donde la pantalla YA es la hoja', () => {
    const i = src.indexOf('xl:grid-cols-[minmax(0,672px)_380px]')
    const caja = src.slice(i, i + 2000).match(/className="min-w-0[^"]*"/)?.[0] ?? ''
    expect(caja).toBeTruthy()
    expect(caja, 'el fondo se aplica también en móvil: tarjeta dentro de tarjeta')
      .not.toMatch(/(^|\s)bg-\[var\(--cf-card\)\]/)
  })
})

describe('la proporción entre capital y ganancia', () => {
  it('se ve en una barra, no solo en cifras', () => {
    /* En cifras hay que restar mentalmente; en la barra se ve de un golpe si el
       interés se está comiendo el préstamo. */
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    expect(panel).toMatch(/calculo\.totalAPagar \* 100/)
  })

  it('y la ganancia va en oro, junto a la cuota', () => {
    const panel = src.slice(src.indexOf('data-panel="cuenta"'))
    const i = panel.indexOf('Ganancia')
    expect(panel.slice(i, i + 400)).toMatch(/var\(--cf-gold\)/)
  })
})
