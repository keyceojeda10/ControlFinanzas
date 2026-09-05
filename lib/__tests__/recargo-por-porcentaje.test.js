/* El recargo como «% del saldo» (5 sep 2026). El dueño: «lo ideal sería ponerle
   el recargo de 15 % sin que tenga que sumar cuánto es a mano; eso lo tendría
   que hacer nuestro sistema». Anclado en lo que se pinta y en lo que viaja. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const HOJA = readFileSync('components/pantallas/Gestion.jsx', 'utf8')
const PAG  = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')

describe('la hoja de recargo acepta un porcentaje del saldo', () => {
  it('tiene el conmutador y el campo en %', () => {
    expect(HOJA).toMatch(/\{ id: 'porcentaje', etiqueta: '% del saldo' \}/)
    expect(HOJA).toMatch(/rotulo="Qué porcentaje del saldo"\s*\n\s*moneda="%"/)
  })
  it('sin `onModo` la hoja es la de siempre (la página de estilo no cambia)', () => {
    expect(HOJA).toMatch(/const conPorcentaje = typeof onModo === 'function'/)
  })
  it('la cifra la calcula el adaptador y viaja por el camino de siempre', () => {
    expect(PAG).toMatch(/fijarAjuste\(String\(montoDesdePorcentaje\(saldoPendiente, n\)\)\)/)
    expect(PAG).toMatch(/atajosPorcentaje=\{atajosPct\}/)
    expect(PAG).toMatch(/\[5, 10, 15, 20\]\.map/)
  })
  it('la nota dice de dónde salió la cifra', () => {
    expect(PAG).toMatch(/% sobre \$\{formatMoney\(Math\.round\(saldoPendiente\)\)\}/)
  })
  it('y la frase de la cuenta se ve: «15 % de $1.470.000 = $220.500»', () => {
    expect(PAG).toMatch(/% de \$\{formatMoney\(Math\.round\(saldoPendiente\)\)\} = \$\{formatMoney\(recargoPorPct\)\}/)
  })
})
