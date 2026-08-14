// lib/__tests__/la-red-no-espera-al-telefono.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Midiendo en el navegador cuántas llamadas hace cada pantalla apareció esto en
// «Cobros de hoy», la que el cobrador abre cada mañana:
//
//     200 → 490 ms   ping · pagos/estado · plan/uso · perfil · … (8, de mantenimiento)
//     589 → 752 ms   metodos-pago · cobros-hoy      ← lo que vino a ver
//
// Parecía que el dato hacía 589 ms de cola detrás de eso, por este orden:
//
//     const cached = await leerDeCache('cobros-hoy')   // abre IndexedDB…
//     …
//     const r = await fetch('/api/cobros-hoy')         // …y HASTA AQUÍ no sale
//
// ══ ⚠ Y LA MEJORA NO EXISTIÓ ══════════════════════════════════════════════
//
// Aquel «589 ms» era UNA muestra de una medición que se mueve cientos de
// milisegundos entre pasadas seguidas —en dos corridas del mismo código dio 300
// y 532—. Comparando las dos versiones con 7 muestras cada una, la app caliente:
//
//     vieja:  sale 252 ms · llega 543 ms
//     nueva:  sale 249 ms · llega 536 ms
//
// Tres milisegundos. Ruido.
//
// El cambio se queda porque no cuesta nada y quita una dependencia sin razón de
// ser —pedir a la red no necesita saber qué hay guardado—, y porque en un
// teléfono viejo con la base local llena esa lectura sí puede pesar. Pero ESTA
// PRUEBA NO DEFIENDE UNA MEJORA DE VELOCIDAD: defiende que no se vuelva a
// encadenar sin motivo. Quien busque tiempo, que no lo busque aquí — el dato
// tarda ~285 ms en ir y volver, y ahí es donde está.
//
// ⚠ NO ES CACHÉ NUEVA NI DATO MÁS VIEJO. Es el MISMO dato, igual de fresco.
// Lo que se pinta mientras llega ya se pintaba antes.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/* Sin comentarios: la primera versión de esta prueba encontraba
   `await leerDeCache` DENTRO de la nota que explica el arreglo y concluía que la
   red seguía esperando. Una prueba que lee texto tiene que leer código. */
const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '')

/**
 * El cuerpo de la función que hace la petición, y solo ese.
 *
 * ⚠ La primera versión de esta prueba buscaba `await leerDeCache` en el ARCHIVO
 * ENTERO y lo comparaba con la petición: en estas pantallas hay varias funciones
 * que leen la caché —la de reconstruir sin señal, por ejemplo— y comparaba
 * posiciones de funciones distintas. Medía cualquier cosa menos lo que quería.
 */
const cuerpoDeLaFuncion = (src) => {
  const i = src.indexOf('const enCamino =')
  if (i === -1) return ''
  const desde = src.lastIndexOf('useCallback(async', i)
  /* El final es el cierre del propio `useCallback`: `\n  }, [deps])`. Cortar en
     «el siguiente useCallback» se pasaba de largo —en clientes se tragaba el
     efecto que pide los conteos de los chips— y la prueba denunciaba una
     petición repetida que estaba en otra función. */
  const cierre = src.slice(i).search(/\r?\n {2}\}, \[/)
  return src.slice(desde === -1 ? 0 : desde, cierre === -1 ? src.length : i + cierre)
}

const PANTALLAS = [
  ['cobros de hoy', 'app/(dashboard)/cobros-hoy/page.jsx', '/api/cobros-hoy'],
  ['dashboard',     'app/(dashboard)/dashboard/page.jsx',  '/api/dashboard/resumen'],
  ['clientes',      'app/(dashboard)/clientes/page.jsx',   '/api/clientes'],
]

describe('la petición sale antes de leer el teléfono', () => {
  it.each(PANTALLAS)('%s dispara la red sin esperar a la caché', (_r, ruta) => {
    const cuerpo = cuerpoDeLaFuncion(leer(ruta))
    expect(cuerpo, 'no se encontró la función que pide los datos').toBeTruthy()
    const iPeticion = cuerpo.indexOf('const enCamino =')
    const iCache = cuerpo.indexOf('await leerDeCache')
    expect(iCache, 'esta función ya no lee la caché: revisar la prueba').toBeGreaterThan(-1)
    expect(iPeticion, 'la red volvió a quedar detrás de IndexedDB').toBeLessThan(iCache)
  })

  it.each(PANTALLAS)('%s pide una sola vez', (_r, ruta, endpoint) => {
    /* Si alguien deja el `fetch` viejo además del adelantado, la pantalla pide
       dos veces y el arreglo se convierte en el doble de trabajo. */
    const cuerpo = cuerpoDeLaFuncion(leer(ruta))
    expect((cuerpo.match(/const enCamino =/g) ?? []).length).toBe(1)
    const veces = (cuerpo.match(new RegExp(`fetch\\(\`?${endpoint.replace(/\//g, '\\/')}`, 'g')) ?? []).length
    expect(veces, `${endpoint} se pide ${veces} veces en la misma función`).toBe(1)
  })

  it.each(PANTALLAS)('%s no dispara una petición sin señal', (_r, ruta) => {
    /* Estando sin red la pantalla va derecho a IndexedDB, como siempre. */
    expect(cuerpoDeLaFuncion(leer(ruta))).toMatch(/const enCamino = navigator\.onLine/)
  })

  it('⚠ lo que se pinta mientras llega sigue siendo lo de siempre', () => {
    /* La caché se sigue pintando igual: esto no mete ni un dato guardado nuevo
       en la pantalla, solo adelanta la petición. */
    expect(leer(PANTALLAS[0][1])).toMatch(/const cached = await leerDeCache\('cobros-hoy'\)\s*\n\s*if \(cached\) \{ setData\(cached\)/)
  })
})
