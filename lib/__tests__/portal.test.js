import { describe, it, expect } from 'vitest'
import { misPagos } from '../adaptadores/portal'

/* ── EL MEDIO DE PAGO EN EL HISTORIAL DEL CLIENTE (C9 · T36-02) ─────────────
   El cliente entra al portal a comprobar que su pago quedo registrado. La
   pantalla del cobrador dice el medio; si la del cliente no lo dice, no se
   pueden poner una al lado de la otra — que es justo para lo que existe. */
describe('misPagos · el medio de pago', () => {
  const fmt = (n) => `$${Number(n).toLocaleString('es-CO')}`

  it('lo enseña cuando el pago lo tiene guardado', () => {
    const [p] = misPagos([{ id: '1', fecha: '2026-07-19', monto: 14500, medio: 'Nequi' }], fmt)
    expect(p.detalle).toBe('Nequi')
  })

  it('sin medio NO inventa «efectivo»: los pagos viejos no lo tienen', () => {
    const [p] = misPagos([{ id: '1', fecha: '2026-07-19', monto: 14500 }], fmt)
    expect(p.detalle).toBeNull()
  })

  it('sigue marcando el abono, que es lo que ya hacia', () => {
    const [p] = misPagos([{ id: '1', fecha: '2026-07-19', monto: 8000, tipo: 'abono', medio: 'efectivo' }], fmt)
    expect(p.fecha).toContain('abono')
    expect(p.detalle).toBe('efectivo')
    expect(p.color).toBe('oro')
  })
})
