// lib/__tests__/acciones-llevan-a-su-destino.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Reportado con captura y flecha roja: se escribe «Gest» en el préstamo, sale
// «Ver y gestionar los pagos», se pulsa y —en sus palabras— «no hace nada».
//
// Sí hacía: abría el acordeón del historial, que vive 1.500px más abajo. El
// estado cambiaba, la pantalla no se movía, y desde arriba eso es un botón
// roto. Ejecutar no basta: hay que ir a enseñar lo que se abrió.
//
// Se pulsaron las 53 acciones registradas en el espejo comparando la foto de lo
// VISIBLE antes y después. Cuatro no cambiaban ni un píxel:
//
//   · préstamo → «Ver y gestionar los pagos»  (acordeón muy abajo)
//   · caja     → «Reabrir un cierre ya hecho» (sección muy abajo, y se ofrecía
//                                              sin haber cierre que reabrir)
//   · cliente  → «Marcar hoy como festivo»    (el botón está al final)
//   · ruta     → «Imprimir la hoja»           (⚠ abría un 404: el endpoint que
//                                              llamaba no existe ni existió)
//
// ⚠ La primera versión de la sonda daba «ok» a la del préstamo porque el
// documento CRECÍA. Crecer 1.500px más abajo es precisamente el fallo.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('lo que se abre dentro de la página, se va a enseñar', () => {
  const conAncla = [
    ['app/(dashboard)/prestamos/[id]/page.jsx', 'cf-historial-pagos'],
    ['app/(dashboard)/caja/page.jsx', 'cf-cierre-owner'],
    ['app/(dashboard)/clientes/[id]/page.jsx', 'cf-festivo-hoy'],
  ]

  for (const [ruta, ancla] of conAncla) {
    it(`${ruta.split('/').slice(-2).join('/')}: declara «${ancla}» y ese id existe`, () => {
      const src = leer(ruta)
      expect(src, 'la acción no declara a dónde lleva').toContain(`llevarA: '${ancla}'`)
      // Un `llevarA` que apunta a un id inexistente es peor que no tenerlo:
      // no falla, no avisa, y sigue pareciendo que el botón está roto.
      expect(src, `no hay ningún elemento con id="${ancla}"`).toContain(`id="${ancla}"`)
    })
  }

  it('la caja de acciones sabe llevar', () => {
    const caja = leer('components/acciones/QueNecesitas.jsx')
    expect(caja).toContain('llevarA')
    expect(caja).toMatch(/scrollIntoView/)
  })
})

describe('⚠ ninguna acción llama a un endpoint que no existe', () => {
  it('la hoja de la ruta se imprime, no se descarga de un 404', () => {
    /* `/api/rutas/[id]/hoja` no existe ni existió. Lo llamaban DOS sitios: mi
       acción nueva y el botón de escritorio, que llevaba meses abriendo una
       pestaña en blanco. El botón de móvil siempre hizo lo correcto:
       `window.print()`, que imprime la pantalla con su CSS de impresión. */
    const src = leer('app/(dashboard)/rutas/[id]/page.jsx')
    expect(src, 'volvió el endpoint inventado').not.toMatch(/api\/rutas\/\$\{id\}\/hoja/)
  })
})

describe('lo que cambia datos no se dispara a ciegas', () => {
  it('⚠ «festivo» LLEVA al botón, no lo pulsa', () => {
    /* Es un interruptor: si hoy ya está marcado, volver a pulsarlo lo QUITA.
       Dispararlo desde el buscador podía desmarcar el festivo del negocio
       entero sin que nadie lo viera, porque el botón está al final de la
       ficha. Y marcar festivo cambia lo que se le cobra a toda la cartera. */
    const src = leer('app/(dashboard)/clientes/[id]/page.jsx')
    const bloque = src.slice(src.indexOf("id: 'cli-festivo'"), src.indexOf("id: 'cli-historial'"))
    expect(bloque, 'la acción vuelve a ejecutar el interruptor').not.toMatch(/ejecutar: \(\) => marcarFestivoHoy/)
    expect(bloque).toContain("llevarA: 'cf-festivo-hoy'")
  })

  it('«reabrir el cierre» solo se ofrece si hay cierre que reabrir', () => {
    // Sin cierre, encendía el modo y no se veía nada: ofrecer deshacer algo
    // que no existe.
    const src = leer('app/(dashboard)/caja/page.jsx')
    const bloque = src.slice(src.indexOf("id: 'caja-reabrir'"), src.indexOf("id: 'caja-capital'"))
    expect(bloque).toMatch(/cierres\.some/)
  })
})
