/* Un pago DECLARADO como solo interés no devuelve capital.
 *
 * `repartirPagado` —el que alimenta los informes— ya lo sabía. La ficha del
 * préstamo, que va por `calcularCapitalRestante`, no: metía ese dinero en el
 * reparto y daba por devuelto un capital que nadie devolvió.
 *
 * Medido contra producción el 27 ago 2026: 17 préstamos vivos en 10 negocios
 * y $859.157 de capital fantasma. Las dos funciones ahora contestan lo mismo. */
import { describe, it, expect } from 'vitest'
import { calcularCapitalRestante } from '@/lib/calculos'
import { capitalEnCalle, repartirPagado } from '@/lib/dinero/reparto'

const base = (pagos) => ({
  montoPrestado: 1000000,
  totalAPagar: 1200000,
  montoTotal: 1200000,
  totalPagado: pagos.reduce((a, p) => a + p.montoPagado, 0),
  estado: 'activo',
  pagos,
})

describe('un pago de solo interés no baja el capital', () => {
  it('la ficha no da por devuelto el capital que nadie devolvió', () => {
    const p = base([{ tipo: 'intereses', montoPagado: 142857 }])
    // Le pagaron interés y NADA de capital: sigue debiendo el millón entero.
    expect(calcularCapitalRestante(p)).toBe(1000000)
  })

  it('la ficha y los informes contestan lo mismo', () => {
    for (const pagos of [
      [{ tipo: 'intereses', montoPagado: 142857 }],
      [{ tipo: 'intereses', montoPagado: 50000 }, { tipo: 'normal', montoPagado: 300000 }],
      [{ tipo: 'capital', montoPagado: 200000 }, { tipo: 'intereses', montoPagado: 80000 }],
      [{ tipo: 'normal', montoPagado: 400000 }],
    ]) {
      const p = base(pagos)
      expect(calcularCapitalRestante(p)).toBe(capitalEnCalle(p))
    }
  })

  it('el interés suelto no reparte otra vez los pagos viejos', () => {
    const viejos = [{ tipo: 'normal', montoPagado: 600000 }]
    const antes = calcularCapitalRestante(base(viejos))
    // Llega un cobro de puro interés. Sube `totalAPagar`, como en la vida real.
    const p = base([...viejos, { tipo: 'intereses', montoPagado: 90000 }])
    p.totalAPagar = 1290000
    p.montoTotal = 1290000
    // El capital en la calle NO se mueve: ese cobro no era capital.
    expect(calcularCapitalRestante(p)).toBe(antes)
  })

  it('sin pagos de interés declarados nada cambia', () => {
    const p = base([{ tipo: 'normal', montoPagado: 240000 }])
    const r = repartirPagado(p)
    expect(calcularCapitalRestante(p)).toBe(1000000 - r.capital)
  })
})
