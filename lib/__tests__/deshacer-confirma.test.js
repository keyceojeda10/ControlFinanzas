/* Carlos, 21 oct 2026: «Cuando le doy al botón deshacer… sigue la tarjeta
   igual». Se deshacía (el registro lo dice), pero nada lo confirmaba, y en un
   cliente con otro abono del día la tarjeta casi no cambia. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const PANTALLAS = ['app/(dashboard)/cobros-hoy/page.jsx', 'app/(dashboard)/rutas/[id]/page.jsx']

describe('deshacer un cobro dice que se deshizo', () => {
  for (const f of PANTALLAS) {
    const src = readFileSync(f, 'utf8')
    it(`${f}: deshace el pago por su id exacto`, () => {
      expect(src).toMatch(/const pagoId = d(ata)?\.saldoAntesDelPagoId \?\? d(ata)?\.pagos\?\.\[0\]\?\.id/)
    })
    it(`${f}: con el servidor de acuerdo, pinta «Cobro deshecho» con el nombre`, () => {
      expect(src).toMatch(/\} else \{\s*setDeshecho\(\{ nombre: (undoPago\.)?clienteNombre, monto(: undoPago\.monto)? \}\)/)
      expect(src).toContain('>Cobro deshecho{deshecho.monto ?')
      expect(src).toContain('>{deshecho.nombre}</span>')
    })
    it(`${f}: el aviso va FUERA del de «Deshacer», que se cierra al tocarlo`, () => {
      // Metido dentro (como quedó en Cobrar hoy la primera vez), no sale nunca.
      expect(src.indexOf('{deshecho && (')).toBeGreaterThan(src.lastIndexOf('onClick={deshacerPago}'))
    })
  }
})
