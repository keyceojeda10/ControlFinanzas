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
// ⚠ EL SUELO SE QUITÓ, y lo decidió el dueño con las cifras medidas delante:
//   el botón pasa de ofrecer $689.627 a $2.291.307 en un negocio y de $23.392 a
//   $429.483 en otro. Es dinero que se OFRECE, no que se cobre: aplicar el
//   moratorio sigue siendo un botón que hay que pulsar y confirmar.
//
// Lo que cuidan estas pruebas: que no vuelva a colarse un mínimo escondido, ni
// en el cálculo ni en la pantalla. Un suelo oculto convierte una función de pago
// en una que «no se puede aplicar», y nadie sabe por qué.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { graciaEfectiva, calcularInteresMoratorio } from '@/lib/calculos'

describe('⚠ manda el número que configura el prestamista', () => {
  it('el cero de Rincón vale CERO, también en mensual', () => {
    /* Antes valía quince: había un suelo por frecuencia que subía en silencio
       lo que se hubiera configurado. Por eso «no se podía aplicar». */
    expect(graciaEfectiva(0)).toBe(0)
    expect(graciaEfectiva(5)).toBe(5)
    expect(graciaEfectiva(30)).toBe(30)
  })

  it('un número raro no rompe ni inventa gracia', () => {
    // Sin nada configurado manda el valor por defecto del esquema, que es 5.
    expect(graciaEfectiva(undefined)).toBe(5)
    expect(graciaEfectiva('siete')).toBe(0)
    expect(graciaEfectiva(-4)).toBe(0)
  })

  it('⚠ el suelo por frecuencia ya no existe en ningún sitio', () => {
    /* Si vuelve a aparecer escrito a mano en cualquier parte, volvemos a que la
       configuración diga una cosa y el sistema haga otra. */
    const fuente = readFileSync(resolve(process.cwd(), 'lib/calculos.js'), 'utf8')
    expect(fuente).not.toContain('diario: 0, semanal: 7, quincenal: 10, mensual: 15')
    const cuerpo = fuente.slice(fuente.indexOf('export function calcularInteresMoratorio'))
    expect(cuerpo.slice(0, 900)).toMatch(/graciaEfectiva\(diasGracia\)/)
  })

  it('⚠ y la pantalla ya no promete lo que no cumple', () => {
    const pantalla = readFileSync(resolve(process.cwd(), 'app/(dashboard)/configuracion/page.jsx'), 'utf8')
    expect(pantalla).not.toContain('Dias que deben pasar en mora antes de que se empiece a calcular el interes moratorio.')
    expect(pantalla).toMatch(/desde el primer día de atraso/)
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
