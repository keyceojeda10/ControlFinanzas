// lib/__tests__/renovar-hereda-dia-de-cobro.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Renovar no pasaba `diaCobroMes` en ninguna parte, así que el préstamo nuevo
// nacía SIN día de corte. Un prestamista que tiene a todos sus clientes cerrados
// el 30 renovaba a uno y ese cliente se le iba al día que cayera la renovación
// —exactamente el problema que reportó en video, reintroducido por la puerta de
// atrás—. La pantalla de renovar promete que «los datos del préstamo siguen
// enteros»: el día de cobro era el único que no seguía.
//
// La prueba lee el ARCHIVO porque el endpoint no se puede llamar sin base de
// datos, y lo que falló aquí no fue una cuenta: fue un campo que nadie pasaba.
// Es el mismo patrón del selector de cuenta al renovar, que estaba en el API y
// en el componente y no llegaba porque nadie le pasaba los datos.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'app/api/prestamos/[id]/renovar/route.js'), 'utf8')
const sinNotas = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('renovar conserva el calendario del préstamo', () => {
  it('hereda el día de cobro del préstamo que se renueva', () => {
    expect(sinNotas).toMatch(/diaCobroMesDb\s*=\s*mismaFrecuencia/)
    expect(sinNotas).toMatch(/original\.diaCobroMes/)
  })

  it('⚠ solo si la frecuencia no cambia', () => {
    /* Un ancla del día 30 no significa nada en un préstamo diario: heredarla a
       ciegas metería un día de corte donde el calendario no lo usa. */
    expect(sinNotas).toMatch(/const mismaFrecuencia = freq === original\.frecuencia/)
  })

  it('el cálculo lo recibe, no solo la fila', () => {
    /* Guardarlo en la fila sin pasarlo a `calcularPrestamo` dejaría la tabla de
       amortización con las fechas viejas y el préstamo con dos verdades. */
    const llamada = sinNotas.match(/const calc = calcularPrestamo\(\{[\s\S]*?\n  \}\)/)?.[0] ?? ''
    expect(llamada, 'no se encontró la llamada a calcularPrestamo').toBeTruthy()
    expect(llamada).toMatch(/diaCobroMes: diaCobroMesDb/)
  })

  it('las tres columnas del calendario se guardan', () => {
    const creacion = sinNotas.match(/tx\.prestamo\.create\(\{[\s\S]*?\n    \}\)/)?.[0] ?? ''
    expect(creacion, 'no se encontró la creación del préstamo').toBeTruthy()
    for (const campo of ['diaCobroSemana:', 'diaCobroMes:', 'diaCobroMes2:', 'primerCobro:']) {
      expect(creacion, `falta ${campo} al crear el préstamo renovado`).toContain(campo)
    }
  })
})
