// lib/__tests__/trozo-que-falta-se-recarga.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Loading chunk 2799 failed» es el ÚNICO error de pantalla que seguía vivo en
// producción el 16 ago 2026: **88 avisos en 19 negocios**. Y se dispara los días
// que más desplegamos — 85 el 14 de agosto y 90 el 15, contra unos 20 de un día
// normal. O sea: lo causamos nosotros.
//
// El navegador tiene cargado el HTML del build anterior y pide un trozo de
// JavaScript cuyo nombre ya no existe (el nombre lleva el hash del contenido).
// Reintentar no sirve: se vuelve a pedir el mismo archivo. Solo lo arregla
// traer el HTML nuevo.
//
// ⚠ LO QUE ESTAS PRUEBAS CUIDAN NO ES QUE RECARGUE, ES QUE NO SE VUELVA UN
//   BUCLE. Un cobrador atrapado en un ciclo de recargas a media ruta está peor
//   que con la pantalla de error: al menos esa le deja seguir cobrando sin
//   conexión. Por eso la guarda de sesión y el «solo con red» son la parte que
//   de verdad hay que fijar.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/error.jsx'), 'utf8')

/* El efecto que recarga por versión, aislado del resto del archivo. */
const bloque = src.slice(
  src.indexOf('EL FALLO QUE CAUSAMOS NOSOTROS AL DESPLEGAR'),
  src.indexOf("}, [error, sinRed])", src.indexOf('EL FALLO QUE CAUSAMOS')) + 20,
)

describe('el trozo que falta se arregla trayendo el HTML nuevo', () => {
  it('reconoce las cuatro formas en que lo dice cada navegador', () => {
    /* Chrome dice «Loading chunk N failed», Safari «Importing a module script
       failed», y el App Router lo envuelve en `ChunkLoadError`. Con una sola
       de las cuatro, media flota se queda fuera. */
    for (const forma of [
      'ChunkLoadError',
      'Loading chunk 2799 failed',
      'Failed to fetch dynamically imported module',
      'Importing a module script failed',
    ]) {
      const re = /ChunkLoadError\|Loading chunk \[\\w-\]\+ failed\|Failed to fetch dynamically imported module\|Importing a module script failed/
      expect(bloque, 'cambió el reconocedor de errores de trozo').toMatch(re)
      // Y que la expresión de verdad reconozca la forma:
      const patron = /ChunkLoadError|Loading chunk [\w-]+ failed|Failed to fetch dynamically imported module|Importing a module script failed/i
      expect(patron.test(forma), `no reconoce «${forma}»`).toBe(true)
    }
  })

  it('⚠ una sola vez: la guarda de sesión antes de recargar', () => {
    /* Se comprueba el ORDEN —preguntar, marcar, recargar— y no el literal: la
       clave va en una variable y fijar el literal solo ata las manos. */
    expect(bloque, 'se fue la clave de la guarda').toMatch(/'cf-chunk-reload'/)
    const iGuarda  = bloque.search(/sessionStorage\.getItem\(/)
    const iMarca   = bloque.search(/sessionStorage\.setItem\(/)
    const iRecarga = bloque.indexOf('window.location.reload()')
    expect(iGuarda, 'se fue la guarda: esto es un bucle de recargas').toBeGreaterThan(-1)
    expect(iMarca, 'no marca que ya recargó').toBeGreaterThan(iGuarda)
    expect(iRecarga, 'recarga antes de marcar que ya recargó').toBeGreaterThan(iMarca)
  })

  it('⚠ solo con red: sin conexión manda el camino de seguir cobrando', () => {
    expect(bloque).toMatch(/if \(sinRed \|\| !error\) return/)
  })

  it('no toca nada de lo guardado en el teléfono', () => {
    /* Borrar cachés o IndexedDB se llevaría por delante los cobros que aún no
       han subido. Se recarga y ya: las navegaciones van por red primero. */
    expect(bloque).not.toMatch(/caches\.delete|indexedDB|deleteDatabase|clear\(\)/)
  })

  it('le dice al usuario qué está pasando, no «cargando» a secas', () => {
    expect(src).toMatch(/Actualizando a la última versión/)
  })
})
