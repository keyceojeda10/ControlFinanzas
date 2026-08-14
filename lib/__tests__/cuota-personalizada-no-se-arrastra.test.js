// lib/__tests__/cuota-personalizada-no-se-arrastra.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un prestamista grabó el caso el 13 ago 2026: presta $2.000.000 al 5% a 12
// meses y elige «Interés sobre lo que falta (como los bancos)». La tarjeta del
// modo dice, con todas sus letras, «12 cuotas de $225.700». Al bajar, el campo
// «Cuota fija personalizada (opcional)» aparecía RELLENO con $266.700 —la cuota
// del modo clásico, el que acababa de abandonar—. Sus palabras: «según Excel
// son de 225.700 [...] tengo que ponerlo manual».
//
// La causa: `onChange` leía `calculo.cuotaDiaria` en el mismo renderizado en el
// que cambia el modo, así que `calculo` todavía era el del modo ANTERIOR. Y ese
// número no es cosmético: en modo saldo, una cuota escrita GANA sobre la
// fórmula (`if (cuotaManualNum > 0) cuotaRegular = cuotaManualNum`).
//
// Medido contra producción replayando `calcularPrestamo`: de 108 préstamos
// «sobre saldo», 12 en 6 negocios quedaron con la cuota exacta de otro modo, 9
// de ellos vivos. El mayor: $15.000.000 al 8% guardado con cuota $4.950.000
// donde tocaban $4.528.900.
//
// El campo se rellenaba solo y nadie veía un error: por eso la prueba mira la
// PANTALLA, no el cálculo — `lib/calculos.js` hacía lo que le pedían.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = readFileSync(resolve(process.cwd(), 'app/(dashboard)/prestamos/nuevo/page.jsx'), 'utf8')
const sinNotas = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const cambiarDeModo = sinNotas(src).match(/onChange=\{\(m\) => \{[\s\S]*?\}\}/)?.[0] ?? ''

describe('cambiar de modo de interés', () => {
  it('deja vacía la cuota personalizada', () => {
    expect(cambiarDeModo, 'no se encontró el manejador del selector de modo').toBeTruthy()
    expect(cambiarDeModo).toMatch(/if \(m !== 'manual'\) setCuotaManual\(''\)/)
  })

  it("⚠ 'saldo' NO se exceptúa del vaciado", () => {
    /* Ésta es la línea del fallo, literal. Volver a añadir `&& m !== 'saldo'`
       reabre el caso: el campo se vuelve a rellenar con la cuota del modo que
       se abandona. */
    expect(cambiarDeModo, "volvió la excepción de 'saldo': el campo se rellena solo")
      .not.toMatch(/m !== 'saldo'/)
  })

  it("'manual' sí conserva su cuota de partida", () => {
    /* En `manual` la cuota no es opcional —la pone el prestamista a propósito—
       así que ahí sembrar un valor es lo correcto, no el fallo. */
    expect(cambiarDeModo).toMatch(/else if \(calculo\?\.cuotaDiaria\) setCuotaManual\(String\(calculo\.cuotaDiaria\)\)/)
  })

  it('el campo sigue diciendo que es opcional y se puede dejar vacío', () => {
    /* Si el texto promete «automático», el campo tiene que llegar vacío. La
       contradicción entre los dos era lo que se veía en el video. */
    expect(src).toContain('Cuota fija personalizada (opcional)')
    expect(src).toContain('Dejar vacío para calcular automático')
  })
})
