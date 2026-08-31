// lib/__tests__/cabecera-y-volver-en-las-hojas.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Dos cosas del 31 ago 2026, las dos con captura del dueño:
//
//   «El de renovar préstamo sale con la cabecera cortada, y lo mismo el de
//    cambiar el modo de interés. El de liquidar hoy sale perfecto.»
//
//   «Ninguna de esas opciones de gestión del préstamo permite volver hacia
//    atrás, al menú general de la gestión. Solo permite salirse, y al salirse
//    vuelve a la pantalla general del préstamo, no al menú de gestión.»
//
// ⚠ SE MIRA EL CÓDIGO, NO LOS COMENTARIOS: este fichero cita los patrones
// viejos y una búsqueda ingenua los encontraría aquí mismo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const raiz = resolve(__dirname, '../..')
const quitarComentarios = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, ' ')
  .replace(/(^|\s)\/\/[^\n]*/g, '$1 ')

const leer = (r) => quitarComentarios(readFileSync(resolve(raiz, r), 'utf8'))

/* Los tokens viven en `app/tokens-2026.css`, que es donde los busca
   `tokens-existen.test.js`: declararlos en `globals.css` los deja huérfanos. */
const css      = readFileSync(resolve(raiz, 'app/tokens-2026.css'), 'utf8')
const modal    = leer('components/ui/Modal.jsx')
const hoja     = leer('components/cf/HojaInferior.jsx')
const sheet    = leer('components/ui/BottomSheet.jsx')
const pagina   = leer('app/(dashboard)/prestamos/[id]/page.jsx')

describe('⚠ la cabecera del modal no se sale por arriba', () => {
  it('el tope de altura NO son dos clases de Tailwind peleando', () => {
    /* EL FALLO EXACTO, y estaba «arreglado» en el código.
     *
     * `Modal.jsx` llevaba `max-h-[90vh] max-h-[90dvh]` con un comentario que
     * explicaba bien por qué hace falta `dvh`. Pero en CSS no manda el orden de
     * las clases en el atributo, manda el orden en la HOJA — y Tailwind emitía
     * `.max-h-[90dvh]` en la posición 18567 y `.max-h-[90vh]` en la 18601.
     * Misma especificidad, gana la última: mandaba el `vh`, que era justo el
     * que se quería evitar.
     *
     * En Safari de iPhone `100vh` es más alto que lo que se ve, y como el modal
     * se ancla abajo, lo que se sale es la cabecera. */
    expect(modal).not.toMatch(/max-h-\[90vh\]/)
    expect(sheet).not.toMatch(/max-h-\[90vh\]/)
  })

  it('sale de un token que decide con @supports', () => {
    /* Ahí el orden lo controlamos nosotros: la regla del `@supports` va después
       de la base, así que `dvh` gana donde se entiende y el `vh` sigue de
       respaldo donde no. */
    expect(css).toMatch(/--cf-alto-modal:\s*90vh/)
    expect(css).toMatch(/--cf-alto-hoja:\s*88vh/)
    const i = css.indexOf('@supports (height: 1dvh)')
    expect(i).toBeGreaterThan(-1)
    const dentro = css.slice(i, i + 260)
    expect(dentro).toMatch(/--cf-alto-modal:\s*90dvh/)
    expect(dentro).toMatch(/--cf-alto-hoja:\s*88dvh/)
    // y el respaldo tiene que ir ANTES, o el @supports no pisa nada
    expect(css.indexOf('--cf-alto-modal: 90vh')).toBeLessThan(i)
  })

  it('las tres cáscaras usan el token', () => {
    expect(modal).toMatch(/maxHeight: 'var\(--cf-alto-modal\)'/)
    expect(sheet).toMatch(/maxHeight: 'var\(--cf-alto-hoja\)'/)
    expect(hoja).toMatch(/alturaMaxima = 'var\(--cf-alto-hoja\)'/)
  })
})

describe('⚠ desde el menú de Gestión se puede volver al menú', () => {
  it('las dos cáscaras saben pintar la flecha', () => {
    for (const [nombre, src] of [['Modal', modal], ['HojaInferior', hoja]]) {
      expect(src, nombre).toMatch(/onVolver/)
      expect(src, nombre).toMatch(/aria-label="Volver"/)
    }
  })

  it('y la flecha convive con la X: son salidas distintas', () => {
    /* La flecha vuelve al menú de donde salió; la X cierra y deja la pantalla.
       Si solo hubiera una, corregir dos cosas seguidas obligaría a rehacer el
       camino entero cada vez. */
    for (const src of [modal, hoja]) {
      expect(src).toMatch(/aria-label="Cerrar"/)
    }
  })

  it('⚠ TODAS las cáscaras de cada hoja la reciben, no solo la primera', () => {
    /* ESTO ES LO QUE SE ME ESCAPÓ AL HACERLO.
     *
     * `EditarDiaCobro` tiene TRES cáscaras —dos `Modal` y una `HojaInferior`,
     * porque ramifica por tamaño de pantalla— y el parche automático solo tocó
     * la primera. La fila «Día de cobro» salía sin flecha mientras las otras
     * cuatro la tenían. Es el mismo fallo que ya está fichado: arreglar una vía
     * y dejar la otra. */
    const hojas = [
      'components/prestamos/ModificarPlazo.jsx',
      'components/prestamos/EditarDiaCobro.jsx',
      'components/prestamos/EditarProximoCobro.jsx',
      'components/prestamos/EditarPrestamo.jsx',
      'components/prestamos/RenovarPrestamo.jsx',
    ]
    for (const ruta of hojas) {
      const src = leer(ruta)
      expect(src, ruta).toMatch(/onVolver,/)          // la acepta

      /* Se cuenta, no se parsea. Intentar leer las props del JSX con una
         expresión regular se corta en el `>` de cualquier `=>` que haya dentro
         —`onCerrar={() => …}`— y da cero cáscaras en ficheros que sí las
         tienen. Contar es tosco y no miente. */
      const cascaras = (src.match(/<(?:Modal|HojaInferior|BottomSheet)[\s\n]/g) ?? []).length
      const flechas  = (src.match(/onVolver=\{onVolver\}/g) ?? []).length
      expect(cascaras, `${ruta}: no encontré cáscaras`).toBeGreaterThan(0)
      expect(flechas, `${ruta}: ${cascaras} cáscaras pero solo ${flechas} con flecha`).toBe(cascaras)
    }
  })
})

describe('⚠ la flecha sale solo si de verdad se vino del menú', () => {
  it('la marca se pone al lanzar la acción DESDE el menú', () => {
    expect(pagina).toMatch(/setModalGestionPrestamo\(false\); setVinoDeGestion\(true\); a\.hacer\?\.\(\)/)
  })

  it('y se borra SIEMPRE al cerrar', () => {
    /* Si se quedara puesta, la siguiente hoja abierta desde un chip o desde el
       buscador enseñaría una flecha que lleva a un menú del que nunca salió.
       Medido en el espejo: abriendo «Abonos» por el chip, cero flechas. */
    expect(pagina).toMatch(/const cerrarHoja = \(setter\) => \(\) => \{ setter\(false\); setVinoDeGestion\(false\) \}/)
    expect(pagina).toMatch(/setVinoDeGestion\(false\); setModalGestionPrestamo\(true\)/)
  })

  it('cada hoja del menú la recibe condicionada', () => {
    /* Sin el `vinoDeGestion ?` la flecha saldría siempre. */
    for (const setter of ['setModalPlazo', 'setModalDiaCobro', 'setModalProximoCobro',
      'setModalRenovar', 'setModalCambiarModo', 'setModalClavo', 'setModalLiquidacion']) {
      expect(pagina, setter).toMatch(
        new RegExp(`onVolver=\\{vinoDeGestion \\? volverAGestion\\(${setter}\\) : undefined\\}`))
    }
  })

  it('«Editar el préstamo» no la pinta cuando se llegó por la URL', () => {
    /* Esa hoja también se abre con `?modo=`, y ahí no hay menú al que volver. */
    expect(pagina).toMatch(/onVolver=\{vinoDeGestion && !modoPedido \? volverAGestion\(setModalEditar\) : undefined\}/)
  })
})
