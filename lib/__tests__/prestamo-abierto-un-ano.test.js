import { describe, it, expect } from 'vitest'
import { devengosPendientes } from '@/lib/calculos'

/* ══════════════════════════════════════════════════════════════════════════
   UN AÑO DE UN PRÉSTAMO ABIERTO, PESO A PESO.

   Es la prueba que pidió el dueño: «que no sea agregar un modo y estar un mes
   encontrándole fallos». Si el interés de doce meses con dos abonos de por
   medio no da exacto aquí, no sale.

   El devengo es lo que hace crecer la deuda cuando vence el período — igual
   que un recargo, que es mecánica que ya existe y está probada. Estas pruebas
   fijan CUÁNTO y CUÁNDO.
   ══════════════════════════════════════════════════════════════════════════ */

const BASE = {
  montoPrestado: 690_000,
  totalAPagar: 690_000,
  tasaInteres: 10,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  sinPlazo: true,
  fechaInicio: '2026-01-15T05:00:00.000Z',
  cuotasAmortizacion: [],
  pagos: [],
}
const enero15 = (mes, dia = 15) => `2026-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}T05:00:00.000Z`

describe('cuándo se debe el interés', () => {
  it('el mismo día que se presta no se debe nada', () => {
    /* Cobrar el interés el día uno es cobrar por adelantado algo que nadie
       pactó. Se debe cuando el período ACABA. */
    expect(devengosPendientes(BASE, Date.parse(enero15(1)))).toEqual([])
  })

  it('a los 29 días tampoco: el mes no ha cerrado', () => {
    expect(devengosPendientes(BASE, Date.parse('2026-02-13T05:00:00.000Z'))).toEqual([])
  })

  it('al cumplirse el mes se debe UN interés, y son $69.000', () => {
    const d = devengosPendientes(BASE, Date.parse(enero15(2)))
    expect(d).toHaveLength(1)
    expect(d[0].interes).toBe(69_000)
    expect(d[0].periodo).toBe('2026-02-15')
  })

  it('a los tres meses son tres, uno por mes, no uno acumulado', () => {
    /* Uno acumulado no se puede pagar por partes ni se puede explicar en el
       recibo. Y sin la fecha de cada uno no hay forma de decir cuál está en
       mora. */
    const d = devengosPendientes(BASE, Date.parse(enero15(4)))
    expect(d.map((x) => x.periodo)).toEqual(['2026-02-15', '2026-03-15', '2026-04-15'])
    expect(d.every((x) => x.interes === 69_000)).toBe(true)
  })
})

describe('el abono a capital baja el interés del mes siguiente', () => {
  /* Es la diferencia entre cobrar bien y cobrar de más, y es lo que el cliente
     está comprando cuando abona. */
  const conAbono = {
    ...BASE,
    pagos: [
      { tipo: 'intereses', montoPagado: 69_000, fechaPago: enero15(2) },
      { tipo: 'capital', montoPagado: 200_000, fechaPago: enero15(2, 20) },
    ],
  }

  it('el mes del abono se cobra sobre el capital que había', () => {
    const d = devengosPendientes(conAbono, Date.parse(enero15(3)))
    const febrero = d.find((x) => x.periodo === '2026-02-15')
    expect(febrero.interes).toBe(69_000)
  })

  it('el mes siguiente ya se cobra sobre $490.000', () => {
    const d = devengosPendientes(conAbono, Date.parse(enero15(3)))
    const marzo = d.find((x) => x.periodo === '2026-03-15')
    expect(marzo.capitalBase).toBe(490_000)
    expect(marzo.interes).toBe(49_000)
  })
})

describe('el año entero, con dos abonos', () => {
  /* 12 meses. Abona $200.000 el 20 de febrero y $290.000 el 20 de agosto.
       feb          → 10% de 690.000 = 69.000
       mar … ago    → 10% de 490.000 = 49.000  (6 meses)
       sep … ene 27 → 10% de 200.000 = 20.000  (5 meses)
     Total: 69.000 + 294.000 + 100.000 = 463.000 */
  const unAno = {
    ...BASE,
    pagos: [
      { tipo: 'capital', montoPagado: 200_000, fechaPago: enero15(2, 20) },
      { tipo: 'capital', montoPagado: 290_000, fechaPago: enero15(8, 20) },
    ],
  }

  it('son doce devengos, uno por mes', () => {
    const d = devengosPendientes(unAno, Date.parse('2027-01-15T05:00:00.000Z'))
    expect(d).toHaveLength(12)
  })

  it('el interés del año da $463.000 exactos', () => {
    const d = devengosPendientes(unAno, Date.parse('2027-01-15T05:00:00.000Z'))
    expect(d.reduce((a, x) => a + x.interes, 0)).toBe(463_000)
  })

  it('y cada tramo cobra sobre el capital que tocaba', () => {
    const d = devengosPendientes(unAno, Date.parse('2027-01-15T05:00:00.000Z'))
    const por = Object.fromEntries(d.map((x) => [x.periodo, x.interes]))
    expect(por['2026-02-15']).toBe(69_000)   // antes del primer abono
    expect(por['2026-03-15']).toBe(49_000)   // ya con 490.000
    expect(por['2026-08-15']).toBe(49_000)   // el abono de agosto es DESPUÉS
    expect(por['2026-09-15']).toBe(20_000)   // ya con 200.000
    expect(por['2027-01-15']).toBe(20_000)
  })
})

describe('lo que ya se devengó no se vuelve a devengar', () => {
  it('los períodos ya asentados no salen otra vez', () => {
    /* Es EL fallo que mató a la línea de crédito: devengar dos veces. Aquí el
       llamador pasa lo ya asentado y la función no lo repite. */
    const d = devengosPendientes(
      { ...BASE, devengos: [{ periodo: '2026-02-15' }, { periodo: '2026-03-15' }] },
      Date.parse(enero15(4)),
    )
    expect(d.map((x) => x.periodo)).toEqual(['2026-04-15'])
  })

  it('correrlo dos veces seguidas no cobra dos veces', () => {
    const ya = devengosPendientes(BASE, Date.parse(enero15(4)))
    const otra = devengosPendientes({ ...BASE, devengos: ya }, Date.parse(enero15(4)))
    expect(otra).toEqual([])
  })
})

describe('no le pasa a nadie más', () => {
  it('un Globo con plazo no devenga nada: su interés ya está en la tabla', () => {
    expect(devengosPendientes(
      { ...BASE, sinPlazo: false, cuotasAmortizacion: [{ numeroPeriodo: 1 }] },
      Date.parse('2027-01-15T05:00:00.000Z'),
    )).toEqual([])
  })

  it('ningún otro modo devenga, aunque le pongan la bandera', () => {
    for (const modo of ['fijo', 'unico', 'saldo', 'manual', 'lineal', 'lineal_dinamico']) {
      expect(devengosPendientes({ ...BASE, modoInteres: modo }, Date.parse('2027-01-15T05:00:00.000Z')), modo).toEqual([])
    }
  })

  it('un préstamo saldado deja de devengar', () => {
    expect(devengosPendientes(
      { ...BASE, pagos: [{ tipo: 'capital', montoPagado: 690_000, fechaPago: enero15(2, 20) }] },
      Date.parse('2027-01-15T05:00:00.000Z'),
    ).filter((x) => x.periodo > '2026-02-15')).toEqual([])
  })
})
