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
    expect(armazon).toMatch(/'--cf-hueco-pie': armazon\.pastilla \? '112px' : '0px'/)
  })

  it('ya no hay un bloque hermano que sume altura siempre', () => {
    /* Era `<div className="h-[112px] lg:hidden" />` DESPUÉS del contenedor. */
    expect(armazon, 'volvió el bloque de 112px').not.toMatch(/className="h-\[112px\] lg:hidden"/)
  })

  it('sigue habiendo pastilla: el hueco existe para ella, no en su lugar', () => {
    expect(armazon).toMatch(/\{armazon\.pastilla && <PastillaNav/)
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
