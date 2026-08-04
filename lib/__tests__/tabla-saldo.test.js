import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { adaptarTabla } from '@/lib/adaptadores/tabla'

// T12-03, su pie: «las seis cuotas de un vistazo con UNA COLUMNA QUE HOY NO
// EXISTE: el saldo despues, que es lo que el cliente pregunta cuando reclama».
//
// El dato estaba en la base (`CuotaAmortizacion.saldoRestante`) y el API lo
// devuelve —`cuotasAmortizacion` va sin `select`, asi que trae la fila
// entera—; lo que faltaba era sacarlo del adaptador.
const jsx = readFileSync(resolve(process.cwd(), 'components/pantallas/TablaAmortizacion.jsx'), 'utf8')

const PRESTAMO = {
  montoPrestado: 1000000,
  totalAPagar: 1699999,
  frecuencia: 'mensual',
  cuotasAmortizacion: [
    { numeroPeriodo: 1, capital: 166667, interes: 200000, cuotaTotal: 366667, saldoRestante: 833333, pagado: 0, fechaEsperada: '2026-08-21T05:00:00.000Z' },
    { numeroPeriodo: 2, capital: 166667, interes: 166667, cuotaTotal: 333334, saldoRestante: 666666, pagado: 0, fechaEsperada: '2026-09-21T05:00:00.000Z' },
  ],
}

describe('el saldo despues de cada cuota', () => {
  it('el adaptador lo produce', () => {
    const t = adaptarTabla(PRESTAMO, { pais: 'CO' })
    expect(t.cuotas[0].saldo).toBe('$833.333')
    expect(t.cuotas[1].saldo).toBe('$666.666')
  })

  it('sin el dato NO inventa un cero', () => {
    // Un «$0» de saldo diria que el prestamo esta pagado, que es lo contrario
    // de no saberlo. La fila no pinta el renglon.
    const t = adaptarTabla({
      ...PRESTAMO,
      cuotasAmortizacion: [{ numeroPeriodo: 1, capital: 1, interes: 1, cuotaTotal: 2, pagado: 0 }],
    }, { pais: 'CO' })
    expect(t.cuotas[0].saldo).toBeNull()
  })

  it('la pantalla lo pinta, y solo si existe', () => {
    expect(jsx).toContain('Le queda debiendo')
    expect(jsx).toMatch(/\{c\.saldo && \(/)
  })

  it('va en su propio renglon, no como cuarta columna', () => {
    // En un telefono, cuatro cifras en una fila se cortan: es lo que ya paso
    // con las tarjetas de ruta.
    const i = jsx.indexOf('Le queda debiendo')
    const bloque = jsx.slice(Math.max(0, i - 300), i)
    expect(bloque).toMatch(/justifyContent: 'space-between'/)
  })

  it('el renglon NO usa filete', () => {
    // `tabla-cotejo` fija que cada cuota sea SU PROPIA tarjeta y no filas
    // separadas por lineas dentro de una caja plana: con filetes, la cuota que
    // toca no se puede destacar sin romper la caja. Mi primera version puso un
    // `borderTop` aqui dentro y rompio esa prueba. Se separa con aire.
    const i = jsx.indexOf('Le queda debiendo')
    const bloque = jsx.slice(Math.max(0, i - 300), i)
    expect(bloque).not.toMatch(/borderTop/)
  })
})
