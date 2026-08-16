// lib/__tests__/gracia-de-mora-no-miente.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Aunque tiene intereses Moratorio, no se puede aplicar, y que automáticamente
//  aplique a los préstamos en mora.»
//   — Miguel Ángel (Préstamos Rincón), por el banner, 15 ago 2026.
//
// Tenía razón, y la causa no era que faltara el botón: es que el número que él
// configuró NO ERA EL QUE SE APLICABA.
//
// Medido contra producción, en solo lectura:
//   · Tasa 0,85 % puesta y días de gracia en CERO, a propósito.
//   · Sus 20 préstamos activos son todos MENSUALES.
//   · El cálculo sube la gracia a un mínimo por frecuencia — 15 en mensual—,
//     así que su cero valía quince.
//   · De sus 2 préstamos en mora, aplicables: CERO. Respetando su cero: 2.
//
// Y la pantalla decía, literalmente, «días que deben pasar en mora antes de que
// se empiece a calcular el interés moratorio». Para un mensual eso era falso.
//
// ⚠ ESTO NO CAMBIA EL SUELO. Quitarlo mueve dinero real: el botón pasaría de
//   ofrecer $689.627 a $2.291.307 en un negocio y de $23.392 a $429.483 en otro,
//   y esa decisión es del dueño. Lo que se arregla aquí es el SILENCIO: que la
//   pantalla diga el número que de verdad se aplica.
//
// Lo que cuidan estas pruebas: que el número de la pantalla y el del cálculo
// salgan del MISMO sitio. Copiado en dos, un día cambia uno y volvemos a que la
// configuración diga una cosa y el sistema haga otra.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { GRACIA_MINIMA_POR_FRECUENCIA, graciaEfectiva, calcularInteresMoratorio } from '@/lib/calculos'

describe('⚠ la gracia que se enseña es la que se aplica', () => {
  it('el cero de Rincón vale quince en un préstamo mensual', () => {
    expect(graciaEfectiva(0, 'mensual')).toBe(15)
    expect(graciaEfectiva(0, 'diario')).toBe(0)
  })

  it('un número mayor que el mínimo manda', () => {
    expect(graciaEfectiva(30, 'mensual')).toBe(30)
    expect(graciaEfectiva(20, 'quincenal')).toBe(20)
  })

  it('una frecuencia desconocida no inventa gracia', () => {
    expect(graciaEfectiva(3, 'lo-que-sea')).toBe(3)
  })

  it('⚠ el cálculo usa esa misma función, no una copia', () => {
    /* Si `calcularInteresMoratorio` volviera a escribir la tabla por dentro, la
       pantalla podría enseñar un número y el cálculo aplicar otro — que es el
       fallo entero. */
    const fuente = readFileSync(resolve(process.cwd(), 'lib/calculos.js'), 'utf8')
    const cuerpo = fuente.slice(fuente.indexOf('export function calcularInteresMoratorio'))
    expect(cuerpo.slice(0, 900)).toMatch(/graciaEfectiva\(diasGracia, freq\)/)
    // Y la tabla aparece UNA sola vez en todo el archivo.
    expect(fuente.match(/diario: 0, semanal: 7, quincenal: 10, mensual: 15/g)).toHaveLength(1)
  })

  it('⚠ la pantalla lo lee de ahí y no lo escribe a mano', () => {
    const pantalla = readFileSync(resolve(process.cwd(), 'app/(dashboard)/configuracion/page.jsx'), 'utf8')
    expect(pantalla).toMatch(/import \{ GRACIA_MINIMA_POR_FRECUENCIA, graciaEfectiva \} from '@\/lib\/calculos'/)
    expect(pantalla).toMatch(/graciaEfectiva\(diasGraciaMoratorio, f\)/)
  })

  it('⚠ y ya no promete que se calcula desde el día que se ponga', () => {
    /* El texto viejo era el que engañaba. */
    const pantalla = readFileSync(resolve(process.cwd(), 'app/(dashboard)/configuracion/page.jsx'), 'utf8')
    expect(pantalla).not.toContain('Dias que deben pasar en mora antes de que se empiece a calcular el interes moratorio.')
  })
})

describe('el comportamiento del cálculo no cambió', () => {
  const base = {
    estado: 'activo', frecuencia: 'mensual', modoInteres: 'fijo',
    montoPrestado: 1000000, totalAPagar: 1200000,
    fechaInicio: new Date('2026-01-01T05:00:00Z'),
    proximoCobro: new Date('2026-08-01T05:00:00Z'),
    pagos: [],
  }

  it('sin tasa no hay moratorio', () => {
    expect(calcularInteresMoratorio(base, [], [], 0, 5).aplicable).toBe(false)
  })

  it('un préstamo que no está activo tampoco', () => {
    expect(calcularInteresMoratorio({ ...base, estado: 'completado' }, [], [], 20, 5).aplicable).toBe(false)
  })
})
