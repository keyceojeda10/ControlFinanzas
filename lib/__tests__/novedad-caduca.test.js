// lib/__tests__/novedad-caduca.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «El último banner de novedades es de hace mucho tiempo y todavía sigue
//  saliendo como si fuera una novedad. Y eso lo que hace es estorbar. No es una
//  novedad, ya pasó hace mucho tiempo.»
//   — el dueño, 15 ago 2026.
//
// La condición para abrirlo NO miraba la fecha: bastaba con que la versión
// fuera mayor que la última vista. La novedad del **18 de julio** llevaba un mes
// abriéndose sola encima del panel, y a quien se registró después le salía como
// «novedad» algo que para él era simplemente cómo es la app.
//
// Lo que estas pruebas cuidan:
//
//   1. Que se vuelva a abrir una novedad vieja.
//   2. Que se publique una novedad SIN FECHA. Sin fecha no se puede caducar, y
//      la de arriba volvería tal cual — en silencio, porque nadie mira un modal
//      que se abre «como siempre».
//   3. Que la caducada se quede esperando en vez de darse por vista.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { NOVEDADES, NOVEDADES_VERSION, DIAS_QUE_DURA_UNA_NOVEDAD, novedadVigente } from '@/lib/novedades'

const dia = (n) => new Date(Date.now() + n * 86400000)

describe('⚠ una novedad caduca', () => {
  const hoy = new Date('2026-08-15T18:00:00.000Z')

  it('el día que se publica, se abre', () => {
    expect(novedadVigente({ fecha: '2026-08-15' }, hoy)).toBe(true)
  })

  it('al día siguiente todavía', () => {
    expect(novedadVigente({ fecha: '2026-08-14' }, hoy)).toBe(true)
  })

  it('pasada la ventana, ya no', () => {
    expect(novedadVigente({ fecha: '2026-08-13' }, hoy)).toBe(false)
  })

  it('⚠ la del 18 de julio, que es la que estorbaba, no se abre', () => {
    expect(novedadVigente({ fecha: '2026-07-18' }, hoy)).toBe(false)
  })

  it('sin fecha no se abre: no hay forma de caducarla', () => {
    expect(novedadVigente({}, hoy)).toBe(false)
    expect(novedadVigente({ fecha: '' }, hoy)).toBe(false)
    expect(novedadVigente({ fecha: 'mañana' }, hoy)).toBe(false)
    expect(novedadVigente(null, hoy)).toBe(false)
  })

  it('una fecha en el futuro tampoco', () => {
    /* Un dedazo al escribirla la dejaría abierta días enteros. */
    expect(novedadVigente({ fecha: '2026-09-01' }, hoy)).toBe(false)
  })

  it('la ventana es de días, corta y a la vista', () => {
    expect(DIAS_QUE_DURA_UNA_NOVEDAD).toBeGreaterThan(0)
    expect(DIAS_QUE_DURA_UNA_NOVEDAD).toBeLessThanOrEqual(3)
  })
})

describe('⚠ el registro de novedades está bien escrito', () => {
  it('todas llevan fecha, y con formato', () => {
    /* Si a una le falta, no se abre nunca y nadie se entera. Aquí sí. */
    const malas = NOVEDADES.filter((n) => !/^\d{4}-\d{2}-\d{2}$/.test(String(n.fecha ?? '')))
    expect(malas.map((n) => n.version), 'novedades sin fecha usable').toHaveLength(0)
  })

  it('la primera del array es la de la versión que se anuncia', () => {
    // El modal pinta `NOVEDADES[0]`, así que si el orden se rompe se anuncia una
    // versión y se enseña otra.
    expect(NOVEDADES[0].version).toBe(NOVEDADES_VERSION)
  })

  it('la de hoy, si mañana se publica una, caducaría igual', () => {
    expect(novedadVigente({ fecha: NOVEDADES[0].fecha }, dia(30))).toBe(false)
  })
})

describe('el modal usa la vigencia y no se la salta', () => {
  const src = readFileSync(resolve(process.cwd(), 'components/layout/NovedadesModal.jsx'), 'utf8')

  it('comprueba la vigencia antes de abrir', () => {
    expect(src).toMatch(/novedadVigente\(NOVEDADES\[0\]\)/)
  })

  it('⚠ la caducada se marca como vista, no se queda esperando', () => {
    /* Sin esto, la vieja no se abre hoy pero salta el día que alguien limpie el
       navegador o entre desde otro teléfono. */
    const bloque = src.slice(src.indexOf('novedadVigente(NOVEDADES[0])'), src.indexOf('setTimeout'))
    expect(bloque).toMatch(/localStorage\.setItem\(LS_KEY, String\(NOVEDADES_VERSION\)\)/)
  })
})
