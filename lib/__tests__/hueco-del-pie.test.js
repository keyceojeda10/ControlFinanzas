import { describe, it, expect } from 'vitest'
import fs from 'node:fs'

/* ══════════════════════════════════════════════════════════════════════════
   «HAY MUCHO ESPACIO EN BLANCO, NO SÉ POR QUÉ» — Socios, 18 de agosto de 2026.

   No era de Socios: era de toda la app. La cuenta en un teléfono de 844px:

       56  la cabecera
     + 844  el contenedor de la pantalla  (min-h-screen)
     + 112  el hueco para que la pastilla no tape la última tarjeta
     ─────
      1012  en una ventana de 844

   O sea que CUALQUIER pantalla corta se deslizaba 168px para no enseñar nada.
   Medido en diez: le pasaba a las diez.

   El hueco tiene que seguir existiendo —lo pidió el dueño porque la pastilla se
   comía el final de la última tarjeta— pero como RELLENO dentro de una caja que
   ya mide una pantalla, no como un bloque hermano que suma altura siempre.
   ══════════════════════════════════════════════════════════════════════════ */

const armazon = fs.readFileSync('components/armazon/Armazon.jsx', 'utf8')
const layout = fs.readFileSync('app/(dashboard)/layout.jsx', 'utf8')

describe('el hueco viaja como medida, no como bloque', () => {
  it('el armazón publica `--cf-hueco-pie`, y solo cuando hay pastilla', () => {
    /* ⚠ La condición pasó de `armazon.pastilla` a `hayPastilla`, que es la
       misma cosa MENOS las pantallas que se declaran tarea. Sin eso, la
       pastilla se sentaba encima del «Continuar» del arranque a 360x640. Lo
       que esta prueba protege sigue igual: la medida se publica y vale 0
       cuando no hay pastilla. */
    expect(armazon).toMatch(/'--cf-hueco-pie': hayPastilla \? '112px' : '0px'/)
    expect(armazon).toMatch(/const hayPastilla = armazon\.pastilla && !dePantalla\?\.tarea/)
  })

  it('ya no hay un bloque hermano que sume altura siempre', () => {
    /* Era `<div className="h-[112px] lg:hidden" />` DESPUÉS del contenedor. */
    expect(armazon, 'volvió el bloque de 112px').not.toMatch(/className="h-\[112px\] lg:hidden"/)
  })

  it('sigue habiendo pastilla: el hueco existe para ella, no en su lugar', () => {
    // La misma condición que el hueco: si divergen, o sobra hueco o falta.
    expect(armazon).toMatch(/\{hayPastilla && <PastillaNav/)
  })
})

describe('el contenedor descuenta lo que tiene encima y debajo', () => {
  it('el alto mínimo resta la cabecera y el hueco', () => {
    expect(layout).toMatch(/min-h-\[calc\(100dvh-56px-var\(--cf-hueco-pie,0px\)\)\]/)
  })

  it('y lo reserva como relleno, para que las pantallas largas no queden tapadas', () => {
    /* Sin esto el hueco desaparecería del todo y la pastilla volvería a comerse
       la última tarjeta — que es el fallo que este hueco vino a arreglar. */
    expect(layout).toMatch(/pb-\[var\(--cf-hueco-pie,0px\)\]/)
  })

  it('sentado manda la altura de la ventana, que ahí no hay pastilla', () => {
    expect(layout).toMatch(/lg:min-h-0 lg:h-screen lg:pb-0/)
  })

  it('ya no queda `min-h-screen` a secas', () => {
    expect(layout).not.toMatch(/className="flex min-h-screen lg:h-screen"/)
  })
})

/* ── Y lo segundo que reportó de Socios ──────────────────────────────────── */
describe('el buscador de Socios ya no queda colgado al fondo', () => {
  const socios = fs.readFileSync('app/(dashboard)/socios/page.jsx', 'utf8')
  const lista = fs.readFileSync('components/pantallas/SociosReparto.jsx', 'utf8')

  it('va entre las cifras y la lista, no detrás de todo', () => {
    /* Con un socio la pantalla mide media ventana: la caja quedaba al fondo con
       170px de nada debajo. Y la lista CRECE, así que un punto de entrada
       puesto detrás de ella se aleja con cada socio nuevo. Medido: acababa en
       492px de 664 y ahora en 320. */
    expect(socios).toMatch(/antesDeLaLista=\{/)
    expect(lista).toMatch(/\{antesDeLaLista\}/)
  })

  it('el bloque oscuro sigue siendo lo primero', () => {
    /* Es «lo único que se viene a mirar aquí», y esa razón no ha cambiado: lo
       que se empuja hacia abajo es la lista, no las cifras. */
    const i = lista.indexOf('{puesto && <LoQuePusieron')
    const j = lista.indexOf('{antesDeLaLista}')
    expect(i).toBeGreaterThan(0)
    expect(i).toBeLessThan(j)
  })

  it('la pantalla ya no se acota al alto de la ventana', () => {
    /* El propio componente lleva escrito que `height: 100%` es lo que obligaba
       a la caja de dentro a deslizarse por su cuenta — y la página se lo estaba
       poniendo por fuera. */
    expect(socios).not.toMatch(/<div style=\{\{ height: '100%', minHeight: 0 \}\}>/)
  })
})

/* ── Y la ficha de un socio, que era la misma historia por dentro ────────── */
describe('la ficha del socio: ni hueco en medio ni buscador de último', () => {
  const ficha = fs.readFileSync('app/(dashboard)/socios/[id]/page.jsx', 'utf8')

  it('el buscador va DENTRO de la cuenta, antes de los dos botones', () => {
    /* Fuera caía después de «Mandarle su cuenta» y «Pagarle», que son las
       acciones de la pantalla: quedaba de último renglón, pegado a la pastilla.
       «En páginas internas de la sección de socios sigue saliendo ese buscador
       abajo del todo» — 18 de agosto, segunda vez. */
    const dentro = ficha.indexOf('<QueNecesitas')
    const cierre = ficha.indexOf('</CuentaSocio>')
    expect(dentro).toBeGreaterThan(0)
    expect(dentro, 'volvió a quedar fuera de la cuenta').toBeLessThan(cierre)
  })

  it('sin los 96px de aire que abrían un agujero en mitad de la pantalla', () => {
    /* `pb-24` reservaba sitio para la pastilla de cuando este bloque ERA el
       final. Ya no lo es, y el hueco lo reserva el armazón para toda la app:
       medido, eran 96px de vacío entre «Registrar aporte» y los botones. */
    expect(ficha).not.toMatch(/className="pb-24 space-y-4"/)
  })

  it('y la pantalla no se acota al alto de la ventana', () => {
    expect(ficha).not.toMatch(/<div style=\{\{ height: '100%', minHeight: 0 \}\}>/)
  })
})
