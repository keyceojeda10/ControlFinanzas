// Borrar un pago tiene que dejar la tabla como si nunca hubiera existido.
//
// ══ POR QUE ════════════════════════════════════════════════════════════════
//
// Registrar un pago SÍ actualizaba la tabla de amortización. Borrarlo NO. Así
// que en un préstamo con tabla las cuotas quedaban marcadas como si el pago
// siguiera ahí, y nada las volvía a tocar. La mora, el próximo cobro y el
// desglose de interés salen de esa tabla: los tres se quedaban mintiendo.
//
// Medido en producción: los reversos de pago pasaron de 17 en abril a 258 en
// julio —ocho al día— y los préstamos desincronizados son todos de julio.
//
// La segunda prueba de aquí es la que más importa, porque es el fallo que casi
// introduzco al arreglar el primero.

import { describe, it, expect } from 'vitest'
import { sePuedeRegenerar } from '../dinero/tabla-sync'
import { regenerarTablaAmortizacion } from '../calculos'

// Un decreciente de 4 cuotas de 25.000.
function prestamoConTabla(pagos = []) {
  return {
    id: 'p1',
    modoInteres: 'lineal',
    montoPrestado: 100000,
    totalAPagar: 100000,
    pagos,
    cuotasAmortizacion: [1, 2, 3, 4].map((n) => ({
      numeroPeriodo: n, capital: 25000, interes: 0, cuotaTotal: 25000,
      saldoRestante: 100000 - n * 25000, pagado: 0, interesPagado: 0,
      fechaEsperada: new Date(`2026-07-0${n}T05:00:00Z`),
    })),
  }
}

const pago = (tipo, monto) => ({ id: `x${Math.random()}`, tipo, montoPagado: monto, fechaPago: new Date() })

describe('la tabla se recalcula desde los pagos que existen', () => {
  it('con dos pagos, dos cuotas quedan cubiertas', () => {
    const p = prestamoConTabla([pago('completo', 25000), pago('completo', 25000)])
    expect(regenerarTablaAmortizacion(p).map((f) => f.pagado)).toEqual([25000, 25000, 0, 0])
  })

  /* ── EL FALLO QUE SE ESTABA GENERANDO ────────────────────────────────────
     Borrar uno de esos pagos dejaba la tabla en [25000, 25000, 0, 0] para
     siempre, aunque solo quedara un pago. Regenerar la deja bien. */
  it('al borrar un pago, la cuota que cubría se libera', () => {
    const p = prestamoConTabla([pago('completo', 25000)])
    expect(regenerarTablaAmortizacion(p).map((f) => f.pagado)).toEqual([25000, 0, 0, 0])
  })

  it('un pago parcial cubre lo que alcanza y no más', () => {
    const p = prestamoConTabla([pago('completo', 25000), pago('parcial', 10000)])
    expect(regenerarTablaAmortizacion(p).map((f) => f.pagado)).toEqual([25000, 10000, 0, 0])
  })

  it('sin pagos, la tabla queda en cero', () => {
    expect(regenerarTablaAmortizacion(prestamoConTabla([])).map((f) => f.pagado)).toEqual([0, 0, 0, 0])
  })
})

describe('CUÁNDO NO SE PUEDE TOCAR — el fallo que casi introduzco', () => {
  /* `regenerarTablaAmortizacion` reparte SOLO los pagos `completo` y `parcial`
     (lib/calculos.js:1390). Una LIQUIDACIÓN no entra en esa cuenta: al cerrar
     anticipado se marcan todas las filas como pagadas de una vez, porque el
     cliente ya no debe nada.

     Regenerar sobre un préstamo liquidado las DESMARCARÍA, dejándolo
     pareciendo que aún debe. Habría cambiado un fallo por otro peor. */
  it('un préstamo con liquidación NO se regenera', () => {
    const p = prestamoConTabla([pago('completo', 25000), pago('liquidacion', 30000)])
    expect(sePuedeRegenerar(p)).toBe(false)
  })

  it('pero si lo que se borró FUE la liquidación, sí se regenera', () => {
    // Ya no queda ninguna en la lista: es justo el caso en que hace falta.
    const p = prestamoConTabla([pago('completo', 25000)])
    expect(sePuedeRegenerar(p)).toBe(true)
  })

  it('un préstamo sin tabla no se toca', () => {
    expect(sePuedeRegenerar({ modoInteres: 'fijo', pagos: [], cuotasAmortizacion: [] })).toBe(false)
  })

  it('ni un préstamo que no existe', () => {
    expect(sePuedeRegenerar(null)).toBe(false)
  })

  it('los pagos a intereses no lo impiden: escriben interesPagado, no pagado', () => {
    const p = prestamoConTabla([pago('completo', 25000), pago('intereses', 5000)])
    expect(sePuedeRegenerar(p)).toBe(true)
  })
})

describe('la propiedad que importa: aplicar y deshacer deja todo igual', () => {
  /* Es la garantía que se le pide a esto: registrar un pago y borrarlo tiene
     que devolver la tabla al estado exacto anterior. Sin ella, cada anulación
     deja un poso — y son ocho al día. */
  it('registrar y borrar devuelve la tabla al punto de partida', () => {
    const antes = regenerarTablaAmortizacion(prestamoConTabla([pago('completo', 25000)]))
    const conElPagoDeMas = regenerarTablaAmortizacion(
      prestamoConTabla([pago('completo', 25000), pago('parcial', 12000)]),
    )
    const despuesDeBorrarlo = regenerarTablaAmortizacion(prestamoConTabla([pago('completo', 25000)]))

    expect(conElPagoDeMas).not.toEqual(antes)      // el pago hizo algo
    expect(despuesDeBorrarlo).toEqual(antes)       // y borrarlo lo deshizo entero
  })

  it('el orden en que llegan los pagos no cambia el resultado', () => {
    // La cascada reparte un TOTAL, así que dos pagos de 10.000 y 15.000 dan lo
    // mismo en cualquier orden. Si esto fallara, editar la fecha de un pago
    // movería plata sin que nadie lo pidiera.
    const a = regenerarTablaAmortizacion(prestamoConTabla([pago('completo', 10000), pago('parcial', 15000)]))
    const b = regenerarTablaAmortizacion(prestamoConTabla([pago('parcial', 15000), pago('completo', 10000)]))
    expect(a).toEqual(b)
  })
})
