import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Créditos pete, 15 nov 2026: «Abonar a capital» va junto a «Hacer abono
// extraordinario», sin reemplazarlo (decisión del dueño).
const src = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
const hoja = src.slice(src.indexOf('title="Opciones de cobro"'), src.indexOf('T05-01 · GESTIÓN DEL PRÉSTAMO'))

describe('Opciones de cobro', () => {
  it('conserva «Hacer abono extraordinario»', () => {
    expect(hoja).toMatch(/>\s*Hacer abono extraordinario\s*<\/button>/)
  })
  it('añade «Abonar a capital», que abre la hoja en Capital', () => {
    expect(hoja).toMatch(/setPresetPago\(\{ tipo: 'capital' \}\)\s*setModalPago\(true\)\s*\}\}[\s\S]{0,400}>\s*Abonar a capital\s*<\/button>/)
  })
})
