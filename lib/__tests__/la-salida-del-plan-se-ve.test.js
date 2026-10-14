/* En el paso del plan, la salida estaba fuera de la pantalla.
 *
 * ══ LO QUE ESTABA PASANDO ══════════════════════════════════════════════════
 *
 * La pantalla «Empieza sin pagar nada» mide 942px y su única acción —«Cargar
 * mi cartera»— vivía al final. Medido en el espejo con una cuenta recién
 * registrada, ANTES del arreglo:
 *
 *   360x640  gama baja       asoman  0px de 52 — hay que deslizar 354px
 *   390x664  iPhone          asoman  0px       — deslizar 274px
 *   412x740  Android común   asoman  0px       — deslizar 198px
 *   412x900  muy alto        asoman 14px       — deslizar  38px
 *
 * En ningún teléfono real se veía. Lo que sí se veía era una lista de precios
 * a alguien que acababa de registrarse para una prueba GRATIS.
 *
 * MEDIDO EN PRODUCCIÓN el 28 ago 2026: 88 de 184 organizaciones de agosto (48%)
 * detenidas en este paso, 69 con CERO clientes. La completitud del onboarding
 * cayó del 82% (junio) al 8% (agosto), y la caída arranca la semana del 13 de
 * julio — cuando esta pantalla entró en el paso 2. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const src = readFileSync('components/onboarding/wizard/WizardPlan.jsx', 'utf8')

describe('la salida del paso del plan se ve sin deslizar', () => {
  it('la barra de acción existe y lleva el botón principal', () => {
    expect(src).toMatch(/position: 'sticky'/)
    const barra = src.slice(src.indexOf("position: 'sticky'"))
    expect(barra).toMatch(/Cargar mi cartera/)
  })

  it('⚠ es `sticky` y NO `fixed`, y esa es toda la diferencia', () => {
    /* `fixed` NO se pega dentro del asistente: `DIV.wizard-step-enter` lleva un
       `transform` de identidad —resto de la animación de entrada— y un ancestro
       con transform crea un contenedor nuevo al que el `fixed` se ancla en vez
       de a la pantalla. Con `fixed` el botón seguía a 903 en una ventana de 740.
       Lo dijo el navegador, no el JSX. */
    expect(src).not.toMatch(/position: 'fixed'/)
  })

  it('se pega al piso: deja sitio a la pastilla SOLO si la hay', () => {
    // Sin hueco, la pastilla tapa el botón — el fallo que este repo ya pagó con
    // «guardar» detrás de la barra. Pero el asistente es una tarea y no lleva
    // pastilla: con el hueco fijo, la barra flotaba a media pantalla (iPhone del
    // dueño, 14 oct 2026). `--cf-hueco-pie` lo pone el armazón: 112 px o 0.
    expect(src).toMatch(/bottom: 'var\(--cf-hueco-pie, 0px\)'/)
    expect(src).not.toMatch(/nav-inset\) \+ 72px/)
  })

  it('el fondo de la barra es el de la pantalla, no el de las tarjetas', () => {
    /* `--cf-surface` es el fondo real del body, medido en el DOM. Con el blanco
       de las tarjetas la barra se leía como un recorte encima del contenido. */
    expect(src).toMatch(/linear-gradient\(to top, var\(--cf-surface\)/)
    expect(src).not.toMatch(/linear-gradient\(to top, var\(--cf-card\)/)
  })

  it('la barra se desvanece por arriba: tiene que verse que hay más', () => {
    // Una barra opaca de borde a borde parece el final de la pantalla y nadie
    // desliza a leer los planes, que es justo lo que la pantalla quiere contar.
    expect(src).toMatch(/transparent 100%\)/)
  })
})
