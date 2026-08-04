import { describe, it, expect } from 'vitest'
import { elInteresSubeLaDeuda } from '@/lib/dinero/modos'

/* Reportado el 4 ago: el préstamo de Yaneris Diaz no abría — pantalla de error
   y sin poder cobrarle. El mensaje decía «falta el `include` de Prisma», y era
   FALSO: comprobado contra la base, ese préstamo NO TIENE NI UNA FILA de tabla.
   Se creó en modo «saldo» sin generarla. Son 12 activos así, todos de junio y
   julio, en 8 negocios distintos. */

describe('modo con tabla al que le falta la tabla', () => {
  it('un `include` OLVIDADO sigue reventando', () => {
    // `undefined` = nadie pidió las filas. Es un error del programador y hay
    // que verlo: seguir en silencio elegiría solo entre dos comportamientos que
    // mueven plata distinta.
    expect(() => elInteresSubeLaDeuda({ id: 'x', modoInteres: 'saldo' })).toThrow(/include/)
    expect(() => elInteresSubeLaDeuda({ id: 'x', modoInteres: 'saldo', cuotasAmortizacion: null })).toThrow(/include/)
  })

  it('un préstamo SIN TABLA en la base no revienta la pantalla', () => {
    // `[]` = se pidieron y no hay ninguna. Es un dato incompleto, no un error
    // de código, y dejaba al prestamista sin poder cobrar.
    expect(() => elInteresSubeLaDeuda({ id: 'x', modoInteres: 'saldo', cuotasAmortizacion: [] })).not.toThrow()
  })

  it('sin tabla, la respuesta segura es que la deuda NO sube', () => {
    // Equivocarse hacia arriba le cobra de más a un cliente; hacia abajo, solo
    // deja de alargar el préstamo.
    expect(elInteresSubeLaDeuda({ id: 'x', modoInteres: 'saldo', cuotasAmortizacion: [] })).toBe(false)
  })

  it('con tabla de verdad sigue diciendo que no sube', () => {
    expect(elInteresSubeLaDeuda({
      id: 'x', modoInteres: 'saldo',
      cuotasAmortizacion: [{ numeroPeriodo: 1, cuotaTotal: 100 }],
    })).toBe(false)
  })

  it('los modos SIN tabla siguen subiendo la deuda', () => {
    // Es la mitad viva de esta función: en modo clásico el pago de interés
    // compra tiempo y el total SÍ sube.
    for (const modo of ['fijo', undefined]) {
      expect(elInteresSubeLaDeuda({ id: 'x', modoInteres: modo })).toBe(true)
    }
  })
})
