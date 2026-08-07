// El texto tiene que LEERSE también en tema oscuro.
//
// ── LAS DOS PAREJAS QUE SE INVIERTEN ───────────────────────────────────────
//
// Los tokens dorados no significan lo mismo en los dos temas, y ahí está la
// trampa: en el código las dos parejas se ven igual de razonables.
//
//   `--cf-gold-ink`  #3A2900 SIEMPRE (no tiene variante oscura)
//                    -> texto sobre dorado SÓLIDO
//   `--cf-gold-text` #7A5800 en claro, pero **#F5B824 en oscuro**
//                    -> texto DORADO sobre fondo neutro
//   `--cf-gold-tint` crema en claro, pero **dorado al 14% sobre carbón** en
//                    oscuro -> o sea, un fondo OSCURO
//
// De ahí salieron los dos fallos que reportó el dueño con capturas:
//
//  1. La tarjeta dorada del panel usaba `gold-text`. En oscuro ese token ES el
//     mismo dorado del fondo: «RECAUDADO HOY», «meta del día», «3 cobrados» y
//     «Toca una barra» DESAPARECÍAN. La tarjeta es dorada siempre, así que su
//     texto va con `gold-ink`.
//  2. El chip activo de la hoja de cobro usaba `gold-ink` sobre `gold-tint`.
//     En oscuro eso es marrón sobre oscuro: «Cuota» casi no se veía.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const leer = (p) => readFileSync(join(process.cwd(), p), 'utf8')
const sinComentarios = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

describe('la tarjeta insignia del panel se lee en los dos temas', () => {
  const PANEL = sinComentarios(leer('components/pantallas/Panel.jsx'))

  /* ── YA NO ES DORADA (Adenda 4) ──
     Esta pareja de pruebas vigilaba que el texto SOBRE EL DORADO usara
     `gold-ink`, porque con `gold-text` desaparecía en tema oscuro. La tarjeta
     dejó de ser dorada —«el fondo dorado no es un estilo, es un error de
     sistema»— así que ese fallo concreto ya no puede darse.

     Pero el riesgo de fondo es el mismo y sigue vivo: la tarjeta es OSCURA en
     los dos temas, igual que antes era dorada en los dos. Si sus colores salen
     de tokens que cambian con el tema, en uno de los dos se queda muda. Por eso
     ahora se comprueba que van fijos. */

  it('su texto NO usa `gold-text` (invisible sobre el bloque oscuro)', () => {
    expect(PANEL).not.toMatch(/color: 'var\(--cf-gold-text\)'/)
  })

  it('los colores del bloque son fijos, no tokens que cambian con el tema', () => {
    const i = PANEL.indexOf('const BLOQUE = {')
    expect(i, 'desapareció la paleta del bloque oscuro').toBeGreaterThan(-1)
    const paleta = PANEL.slice(i, PANEL.indexOf('}', i))
    expect(paleta, 'un token de tema dentro del bloque oscuro: en un tema se queda mudo')
      .not.toMatch(/var\(--cf-/)
    // Los de la adenda, que son los que tienen contraste sobre #15161A.
    expect(paleta).toMatch(/#15161A/)
    expect(paleta).toMatch(/#F5B824/)
  })

  it('y el fondo ya no es dorado', () => {
    // «El dorado sirve para señalar, no para decorar.»
    const i = PANEL.indexOf('function Hero({')
    const hero = PANEL.slice(i, i + 2500)
    expect(hero).not.toMatch(/background: 'var\(--cf-gold\)'/)
  })
})

describe('nadie pone `gold-ink` sobre `gold-tint`', () => {
  // `gold-ink` es marrón fijo y `gold-tint` en oscuro es un fondo oscuro:
  // juntos no se leen. La pareja correcta es `gold-dark`, que sí se aclara.
  const PANTALLAS = [
    'components/pantallas/RegistrarCobro.jsx',
    'components/pantallas/Gestion.jsx',
  ]

  it('el chip activo usa `gold-dark`', () => {
    for (const p of PANTALLAS) {
      const t = sinComentarios(leer(p))
      expect(t, `${p} sigue con gold-ink sobre gold-tint`)
        .not.toMatch(/background: 'var\(--cf-gold-tint\)', color: 'var\(--cf-gold-ink\)'/)
      expect(t, `${p} no usa gold-dark`)
        .toMatch(/background: 'var\(--cf-gold-tint\)', color: 'var\(--cf-gold-dark\)'/)
    }
  })
})

describe('los tokens siguen significando lo que se supone', () => {
  const TOKENS = leer('app/tokens-2026.css')

  it('`gold-ink` NO tiene variante oscura: es tinta sobre dorado', () => {
    // Si alguien le añade una variante oscura, la tarjeta dorada del panel
    // dejaría de leerse otra vez.
    const veces = (TOKENS.match(/--cf-gold-ink:/g) || []).length
    expect(veces).toBe(1)
  })

  it('`gold-text` SÍ cambia en oscuro, por eso no sirve sobre dorado', () => {
    expect((TOKENS.match(/--cf-gold-text:/g) || []).length).toBeGreaterThan(1)
  })
})
