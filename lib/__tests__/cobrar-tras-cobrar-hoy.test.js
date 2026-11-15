import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

// Créditos pete, 15 nov 2026: cobró la cuota del día ($170.000), quedaban
// $20.000 vencidos y el botón de pagar se cambiaba por el letrero verde
// «Cobrado hoy», sin por dónde cobrar lo que faltaba.
const src = readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')

describe('el préstamo que ya cobró hoy y todavía debe', () => {
  it('calcula lo que queda por cobrar: lo vencido, o el resto si es menos de una cuota', () => {
    expect(src).toMatch(/const cobrarTrasHoy = estaActivo && yaPagoHoy && !completado && !\(restaDeLaCuota > 0\) && saldoRedondo > 0/)
    expect(src).toMatch(/hayMontoMora \? Math\.min\(Math\.round\(montoEnMora\), saldoRedondo\)/)
    expect(src).toMatch(/saldoRedondo <= Math\.round\(cuotaDiaria \|\| 0\) \? saldoRedondo : 0/)
  })
  it('el letrero «Cobrado hoy» abre el cobro con esa cifra', () => {
    expect(src).toMatch(/onClick: \(\) => abrirPagoConMonto\(cobrarTrasHoy\)/)
    expect(src).toMatch(/>Cobrar ›<\/span>/)
  })
  it('se declara después de lo que usa (un const antes de tiempo deja la pantalla en blanco)', () => {
    const uso = src.indexOf('const cobrarTrasHoy')
    for (const dep of ['const hayMontoMora', 'const restaDeLaCuota', 'pagoHoy: yaPagoHoy']) {
      expect(src.indexOf(dep), dep).toBeGreaterThan(-1)
      expect(src.indexOf(dep), dep).toBeLessThan(uso)
    }
  })
})
