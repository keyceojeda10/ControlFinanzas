// lib/__tests__/primer-periodo-al-corte.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Un prestamista lo grabó el 13 ago 2026, con el caso montado en pantalla:
//
//   «Nosotros tenemos a todos los clientes cerrados con el día 30. No podemos
//    tener unos el 13, otros el 15, otros el 18. Entonces en la primera cuota
//    me ha tocado hacerlo manual: solamente le cobro los intereses que faltan
//    hasta el día 30. Como estamos a 13, son 17 días.»
//
// Presta $2.000.000 al 5% a 12 meses sobre saldo: 12 cuotas de $225.700. Lo
// hacía a mano porque el sistema cobraba un mes entero durase lo que durase el
// primer tramo. Y si hubiera usado el «¿qué día del mes cobras?» de la app
// habría sido PEOR: la primera cuota se le iba al 30 de septiembre —48 días—
// cobrando los mismos $100.000.
//
// Medido en producción antes de tocar nada: de 205 préstamos mensuales con día
// de corte, 107 tenían el primer periodo desfasado. 48 cortos (uno de $2.000.000
// al 10% cobró el mes entero SIETE DÍAS después de entregar) y 59 largos, de
// hasta 60 días. $3.519.639 de más y $3.400.613 de menos, en 23 negocios.
//
// ── LA LÍNEA QUE NO SE CRUZA ───────────────────────────────────────────────
// Sin día de corte no cambia NADA. Y los modos sin tabla guardada (`fijo`,
// `unico`, `manual`) tampoco: sus fechas se derivan al LEER, así que moverlas
// reprogramaría préstamos que ya están en la calle. Las dos cosas se prueban
// aquí abajo, porque son lo que impide que este arreglo rompa a nadie.

import { describe, it, expect } from 'vitest'
import { calcularPrestamo, primerCobroMensual } from '@/lib/calculos'

const enBogota = (d) => new Date(d).toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric',
})

/** El préstamo del video, tal cual. */
const delVideo = (extra = {}) => calcularPrestamo({
  montoPrestado: 2000000, tasaInteres: 5, diasPlazo: 360,
  fechaInicio: '2026-08-13', frecuencia: 'mensual', modoInteres: 'saldo', ...extra,
})

describe('⚠ sin día de corte no se mueve una coma', () => {
  it('el mismo préstamo del video da exactamente lo de siempre', () => {
    const r = delVideo()
    expect(r.cuotaDiaria).toBe(225700)
    expect(r.totalAPagar).toBe(2707618)
    expect(enBogota(r.tablaAmortizacion[0].fechaEsperada)).toBe('13/9/2026')
    expect(r.tablaAmortizacion[0].interes).toBe(100000)
    expect(r.prorrateoPrimerPeriodo).toBeUndefined()
  })

  it('y en globo tampoco', () => {
    const r = delVideo({ modoInteres: 'solo_interes' })
    expect(r.totalAPagar).toBe(3200000)
    expect(r.tablaAmortizacion.every((f, k) => k === 11 || f.cuotaTotal === 100000)).toBe(true)
  })
})

describe('el primer cobro cae en el primer corte de verdad', () => {
  it('presta el 13 y cobra los 30: la primera es el 30 de AGOSTO', () => {
    /* Antes: 30 de septiembre. 48 días con la plata afuera cobrados como 30. */
    const r = delVideo({ diaCobroMes: 30 })
    expect(enBogota(r.tablaAmortizacion[0].fechaEsperada)).toBe('30/8/2026')
    expect(r.diasPrimerPeriodo).toBe(17)
    expect(r.prorrateoPrimerPeriodo).toBe(true)
  })

  it('y de ahí en adelante todos los 30', () => {
    const r = delVideo({ diaCobroMes: 30 })
    const fechas = r.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada))
    expect(fechas.slice(0, 4)).toEqual(['30/8/2026', '30/9/2026', '30/10/2026', '30/11/2026'])
    expect(fechas).toHaveLength(12)
    expect(enBogota(r.fechaFin)).toBe('30/7/2027')
  })

  it('⚠ un tramo demasiado corto se pasa al corte siguiente', () => {
    /* Presta el 25 y cobra los 1: el 1 de septiembre son 7 días. Cobrar una
       cuota COMPLETA una semana después de entregar la plata no es un cobro,
       es un susto. Se va al 1 de octubre y se cobran los 37 días. */
    const r = calcularPrestamo({
      montoPrestado: 2000000, tasaInteres: 10, diasPlazo: 180,
      fechaInicio: '2026-08-25', frecuencia: 'mensual', modoInteres: 'saldo', diaCobroMes: 1,
    })
    expect(enBogota(r.tablaAmortizacion[0].fechaEsperada)).toBe('1/10/2026')
    expect(r.diasPrimerPeriodo).toBe(37)
  })

  it('el ancla nunca cae antes de entregar el dinero', () => {
    /* `sumarMeses(fecha, 0, ancla)` puede devolver un día del pasado. */
    for (const dia of [1, 5, 13, 20, 28, 30, 31]) {
      for (const inicio of ['2026-01-31', '2026-02-14', '2026-08-13', '2026-11-30']) {
        const cobro = primerCobroMensual(new Date(`${inicio}T05:00:00.000Z`), dia)
        const dias = Math.round((cobro - new Date(`${inicio}T05:00:00.000Z`)) / 86400000)
        expect(dias, `inicio ${inicio} con corte ${dia} dio ${dias} días`).toBeGreaterThanOrEqual(15)
        expect(dias, `inicio ${inicio} con corte ${dia} dio ${dias} días`).toBeLessThanOrEqual(46)
      }
    }
  })
})

describe('el descuento se lo lleva la PRIMERA cuota, no la última', () => {
  it('sobre saldo: la primera baja, las once siguientes no se tocan', () => {
    /* Lo que el prestamista negocia con su cliente es la primera. Dejar que el
       capital absorbiera el descuento abarataba la ÚLTIMA, dentro de un año, y
       le cambiaba el «12 cuotas de $225.700» que el cliente ya tiene escrito. */
    const r = delVideo({ diaCobroMes: 30 })
    const t = r.tablaAmortizacion
    expect(t[0].cuotaTotal).toBe(182367)
    expect(t[0].interes).toBe(56667)
    expect(t[0].capital).toBe(125700)
    expect(t.slice(1, 11).every((f) => f.cuotaTotal === 225700)).toBe(true)

    const sinCorte = delVideo().tablaAmortizacion
    expect(t.map((f) => f.capital)).toEqual(sinCorte.map((f) => f.capital))
    expect(r.totalAPagar).toBe(2707618 - (100000 - 56667))
  })

  it('globo: la primera trae solo los días que corrieron', () => {
    const r = delVideo({ modoInteres: 'solo_interes', diaCobroMes: 30 })
    expect(r.tablaAmortizacion[0].cuotaTotal).toBe(56667)
    expect(r.tablaAmortizacion[1].cuotaTotal).toBe(100000)
    expect(r.tablaAmortizacion[11].cuotaTotal).toBe(2100000)
  })

  it('lineal: el capital por periodo sigue siendo el mismo', () => {
    const r = calcularPrestamo({
      montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
      fechaInicio: '2026-08-13', frecuencia: 'mensual', modoInteres: 'lineal', diaCobroMes: 30,
    })
    expect(r.tablaAmortizacion.every((f) => f.capital === 200000)).toBe(true)
    expect(r.tablaAmortizacion[0].interes).toBe(Math.round(1200000 * 0.05 * 17 / 30))
    expect(r.tablaAmortizacion[1].interes).toBe(Math.round(1000000 * 0.05))
  })
})

describe('la tabla cuadra al peso', () => {
  const casos = [
    ['saldo', 30], ['saldo', 1], ['solo_interes', 30], ['lineal', 15], ['lineal_dinamico', 28],
  ]
  it.each(casos)('%s con corte el %i reparte el capital exacto', (modo, dia) => {
    const r = calcularPrestamo({
      montoPrestado: 3000000, tasaInteres: 4, diasPlazo: 300,
      fechaInicio: '2026-08-13', frecuencia: 'mensual', modoInteres: modo, diaCobroMes: dia,
    })
    const t = r.tablaAmortizacion
    expect(t.reduce((a, f) => a + f.capital, 0)).toBe(3000000)
    expect(t.reduce((a, f) => a + f.cuotaTotal, 0)).toBe(r.totalAPagar)
    expect(t.every((f) => f.cuotaTotal === f.capital + f.interes)).toBe(true)
  })
})

describe('⚠ los modos sin tabla guardada NO se tocan', () => {
  /* `fijo`, `unico`, `manual` y el legacy `proporcional` no devengan interés por
     periodo: es un total pactado repartido en cuotas iguales. Y sus fechas se
     derivan al LEER, con `fechaDePeriodo`, así que cambiarlas reprogramaría los
     préstamos que ya están vivos. Se quedan como están, a propósito. */
  it.each(['fijo', 'unico', 'manual'])('%s conserva su calendario de siempre', (modo) => {
    const args = {
      montoPrestado: 2000000, tasaInteres: 5, diasPlazo: 360,
      fechaInicio: '2026-08-13', frecuencia: 'mensual', modoInteres: modo,
      ...(modo === 'manual' ? { cuotaManual: 300000 } : {}),
    }
    const con = calcularPrestamo({ ...args, diaCobroMes: 30 })
    expect(con.prorrateoPrimerPeriodo).toBeUndefined()
    expect(enBogota(con.fechaFin)).toBe(enBogota(
      calcularPrestamo({ ...args, diaCobroMes: 30, modoInteres: modo }).fechaFin))
    // El vencimiento sigue saliendo del calendario derivado: un mes por cobro
    // desde la fechaInicio, anclado al 30.
    expect(enBogota(con.fechaFin)).toBe('30/8/2027')
  })
})
