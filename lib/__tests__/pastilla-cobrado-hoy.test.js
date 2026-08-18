import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import { cobradoHoy, cuantosPagosHoy, pagosDelDia } from '@/lib/calculos'

/* ══════════════════════════════════════════════════════════════════════════
   «COBRADO HOY · 2 PAGOS $40.000», con dos pagos de $40.000 y $100.000.
   Reportado el 18 de agosto con captura.

   La cuenta NO estaba mal: con esos dos pagos da $140.000, comprobado contra
   los datos de producción. Lo que estaba mal eran otras dos cosas, y las dos
   enseñan una cifra de menos sin avisar:

   1 · La cuenta y la suma usaban DOS «hoy» distintos — la cuenta con la hora
       del teléfono, la suma con la de Colombia.
   2 · La ficha solo preguntaba al montarse: cobrando desde otra pantalla (o
       con dos pestañas, que es lo que él tenía) se quedaba con lo de antes.
   ══════════════════════════════════════════════════════════════════════════ */

const ficha = fs.readFileSync('app/(dashboard)/prestamos/[id]/page.jsx', 'utf8')
const hoja = fs.readFileSync('components/prestamos/RegistrarPago.jsx', 'utf8')

/* Sus dos pagos reales, con la hora exacta que tienen en la base. */
const CASO = { pagos: [
  { tipo: 'completo', montoPagado: 100000, fechaPago: '2026-08-18T12:40:54.674Z' },
  { tipo: 'completo', montoPagado: 40000,  fechaPago: '2026-08-18T12:40:23.039Z' },
  { tipo: 'completo', montoPagado: 160000, fechaPago: '2026-08-16T04:11:47.031Z' }, // 15 ago en Bogotá
] }
const ESE_DIA = Date.parse('2026-08-18T14:55:00Z')

describe('el caso que reportó, con sus cifras', () => {
  it('los dos pagos del día suman $140.000, no $40.000', () => {
    expect(cobradoHoy(CASO, ESE_DIA)).toBe(140000)
  })

  it('y son dos', () => {
    expect(cuantosPagosHoy(CASO, ESE_DIA)).toBe(2)
  })

  it('el pago de las 04:11 UTC NO es de hoy: en Bogotá es del 15', () => {
    /* Es la trampa de siempre: de medianoche a las cinco, el día UTC y el día
       colombiano son distintos. Contarlo habría inflado la cifra. */
    // ⚠ `.sort()` a secas ordena como TEXTO: 100000 antes que 40000. Me falló
    //   la prueba sobre código correcto por eso.
    expect(pagosDelDia(CASO, ESE_DIA).map((p) => p.montoPagado).sort((a, b) => a - b))
      .toEqual([40000, 100000])
  })
})

describe('un solo «hoy» para las dos preguntas', () => {
  it('la cuenta y la suma salen de la misma lista', () => {
    const n = 40
    const pagos = Array.from({ length: n }, (_, i) => ({
      tipo: 'completo', montoPagado: 1000 * (i + 1),
      // Repartidos por todo el día colombiano, incluida la franja 00:00–05:00
      // que es donde UTC y Bogotá se separan.
      fechaPago: new Date(Date.parse('2026-08-18T05:00:00Z') + i * 35 * 60000).toISOString(),
    }))
    const caso = { pagos }
    expect(cuantosPagosHoy(caso, ESE_DIA)).toBe(pagosDelDia(caso, ESE_DIA).length)
    expect(cobradoHoy(caso, ESE_DIA)).toBe(
      pagosDelDia(caso, ESE_DIA).reduce((a, p) => a + p.montoPagado, 0),
    )
  })

  it('los ajustes no son plata que entró', () => {
    const caso = { pagos: [
      { tipo: 'completo', montoPagado: 50000, fechaPago: '2026-08-18T13:00:00Z' },
      { tipo: 'recargo',  montoPagado: 20000, fechaPago: '2026-08-18T13:05:00Z' },
      { tipo: 'descuento', montoPagado: 5000, fechaPago: '2026-08-18T13:06:00Z' },
    ] }
    expect(cobradoHoy(caso, ESE_DIA)).toBe(50000)
    expect(cuantosPagosHoy(caso, ESE_DIA)).toBe(1)
  })

  it('la pantalla ya no cuenta por su cuenta con la hora del teléfono', () => {
    expect(ficha).toMatch(/const pagosDeHoy = cuantosPagosHoy\(\{ pagos \}\)/)
    expect(ficha, 'volvió el «hoy» del aparato').not.toMatch(/toDateString\(\) === new Date\(\)\.toDateString\(\)/)
  })
})

describe('la ficha se vuelve a preguntar al volver a ella', () => {
  it('escucha que la pestaña se vuelva visible', () => {
    /* Es lo que le pasó: con la ficha abierta en una pestaña y el cobro hecho
       en otra, la cifra se quedaba en la de antes. Una pantalla vieja de plata
       no se lee como vieja: se lee como equivocada. */
    expect(ficha).toMatch(/document\.addEventListener\('visibilitychange', alVolver\)/)
    expect(ficha).toMatch(/window\.addEventListener\('focus', alVolver\)/)
  })

  it('y lo hace en silencio, sin vaciar lo que ya se ve', () => {
    expect(ficha).toMatch(/if \(document\.visibilityState === 'visible'\) fetchPrestamo\(\{ soft: true \}\)/)
  })

  it('deja de escuchar al salir', () => {
    expect(ficha).toMatch(/document\.removeEventListener\('visibilitychange', alVolver\)/)
    expect(ficha).toMatch(/window\.removeEventListener\('focus', alVolver\)/)
  })
})

describe('sin red, el pago que se acaba de recibir entra en la lista', () => {
  it('no solo en los totales', () => {
    /* Se ponía `pagoHoy: true` y `pagos` se quedaba igual: la pastilla salía
       —porque pagoHoy era cierto— con la suma de ANTES de ese cobro. */
    expect(hoja).toMatch(/pagos: \[pagoOffline, \.\.\.\(prestamo\.pagos \?\? \[\]\)\]/)
  })

  it('y el pago optimista lleva su tipo, o el filtro no sabe qué es', () => {
    expect(hoja).toMatch(/const pagoOffline = \{ montoPagado: m, tipo, fechaPago:/)
  })
})
