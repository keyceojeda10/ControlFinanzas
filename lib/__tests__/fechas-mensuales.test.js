import { describe, it, expect } from 'vitest'
import {
  calcularPrestamo,
  calcularProximoCobro,
  sumarMeses,
  tienePeriodoEsperadoHoy,
} from '@/lib/calculos'

// Fechas de cobro: reportado por un cliente el 27 jul 2026.
// Presto $10.000.000 al 6% mensual a 6 meses (Globo) con inicio el 5 de julio y
// esperaba cobrar los 5 de cada mes. El sistema le mostro:
//   3 ago, 2 sept, 2 oct, 1 nov, 1 dic, 31 dic
// Eran DOS defectos sumados, cada uno se comia un dia:
//   1. fechaInicio llegaba como string y `new Date('2026-07-05')` es medianoche
//      UTC = 7pm del dia 4 en Bogota -> toda la tabla nacia un dia antes.
//   2. "mensual" sin dia ancla sumaba 30 dias fijos en vez de avanzar un mes de
//      calendario -> se corria un dia mas casi cada mes (julio/agosto/octubre
//      tienen 31 dias) y el desfase se acumulaba.

const enBogota = (d) => d.toLocaleDateString('es-CO', {
  timeZone: 'America/Bogota', day: 'numeric', month: 'numeric', year: 'numeric',
})

describe('sumarMeses', () => {
  it('avanza meses de calendario conservando el dia', () => {
    const base = new Date(Date.UTC(2026, 6, 5, 5)) // 5 jul 2026, medianoche Bogota
    expect(enBogota(sumarMeses(base, 1))).toBe('5/8/2026')
    expect(enBogota(sumarMeses(base, 6))).toBe('5/1/2027')
  })

  it('no se desborda: 31 ene + 1 mes es 28 feb, no 3 mar', () => {
    // setMonth() sin proteccion rueda al 3 de marzo porque el 31 de febrero no existe
    const finEnero = new Date(Date.UTC(2026, 0, 31, 5))
    expect(enBogota(sumarMeses(finEnero, 1))).toBe('28/2/2026')
    expect(enBogota(sumarMeses(finEnero, 2))).toBe('31/3/2026')
    expect(enBogota(sumarMeses(finEnero, 3))).toBe('30/4/2026')
  })

  it('recorta el ancla al ultimo dia del mes cuando no existe', () => {
    const base = new Date(Date.UTC(2026, 0, 15, 5))
    expect(enBogota(sumarMeses(base, 1, 31))).toBe('28/2/2026')
    expect(enBogota(sumarMeses(base, 3, 31))).toBe('30/4/2026')
  })
})

describe('caso reportado: mensual sin dia ancla cobra el mismo dia del mes', () => {
  const prestamoGustavo = (modo) => calcularPrestamo({
    montoPrestado: 10000000,
    tasaInteres: 6,
    diasPlazo: 180,
    fechaInicio: '2026-07-05',
    frecuencia: 'mensual',
    modoInteres: modo,
  })

  it('modo Globo: las 6 cuotas caen el 5 de cada mes', () => {
    const r = prestamoGustavo('solo_interes')
    const fechas = r.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada))
    expect(fechas).toEqual([
      '5/8/2026', '5/9/2026', '5/10/2026', '5/11/2026', '5/12/2026', '5/1/2027',
    ])
  })

  it('modo Decreciente: mismo calendario', () => {
    const r = prestamoGustavo('lineal')
    expect(r.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada))).toEqual([
      '5/8/2026', '5/9/2026', '5/10/2026', '5/11/2026', '5/12/2026', '5/1/2027',
    ])
  })

  it('modo Cuota fija (sin tabla): proximo cobro tambien cae el 5', () => {
    const calc = prestamoGustavo('fijo')
    const fechas = []
    for (let cuotasPagadas = 0; cuotasPagadas < 6; cuotasPagadas++) {
      fechas.push(enBogota(calcularProximoCobro({
        fechaInicio: new Date('2026-07-05T05:00:00.000Z'),
        estado: 'activo',
        cuotaDiaria: calc.cuotaDiaria,
        totalAPagar: calc.totalAPagar,
        diasPlazo: 180,
        frecuencia: 'mensual',
        totalPagado: calc.cuotaDiaria * cuotasPagadas,
      }, [], [])))
    }
    expect(fechas).toEqual([
      '5/8/2026', '5/9/2026', '5/10/2026', '5/11/2026', '5/12/2026', '5/1/2027',
    ])
  })

  it('un dia ancla explicito sigue mandando sobre el dia de la fechaInicio', () => {
    const r = calcularPrestamo({
      montoPrestado: 10000000, tasaInteres: 6, diasPlazo: 180,
      fechaInicio: '2026-07-05', frecuencia: 'mensual', modoInteres: 'solo_interes',
      diaCobroMes: 20,
    })
    // ⚠ ESTA PRUEBA FIJABA EL FALLO. Esperaba que la primera cuota cayera el
    // **20 de agosto**: 46 dias despues de entregar la plata, cobrando un mes de
    // interes. El dia ancla mandaba, si, pero solo despues de saltarse un mes
    // entero. Quien dice «cobro los 20» quiere el 20 que viene, no el otro.
    expect(r.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada))).toEqual([
      '20/7/2026', '20/8/2026', '20/9/2026', '20/10/2026', '20/11/2026', '20/12/2026',
    ])
    // Y ese primer tramo son 15 dias, asi que trae medio mes de interes.
    expect(r.diasPrimerPeriodo).toBe(15)
    expect(r.tablaAmortizacion[0].interes).toBe(300000)
    expect(r.tablaAmortizacion[1].interes).toBe(600000)
  })

  it('prestamo que arranca un 31: los meses cortos se recortan y no se saltan', () => {
    const r = calcularPrestamo({
      montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 120,
      fechaInicio: '2026-01-31', frecuencia: 'mensual', modoInteres: 'lineal',
    })
    expect(r.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada))).toEqual([
      '28/2/2026', '31/3/2026', '30/4/2026', '31/5/2026',
    ])
  })
})

describe('la tabla de amortizacion arranca a un periodo de la fecha de inicio', () => {
  // Antes nacian todas un dia antes por el parseo del string como medianoche UTC.
  const casos = [
    { freq: 'diario',    plazo: 30,  primerCobro: '6/7/2026' },
    { freq: 'semanal',   plazo: 56,  primerCobro: '12/7/2026' },
    { freq: 'quincenal', plazo: 60,  primerCobro: '20/7/2026' },
    { freq: 'mensual',   plazo: 180, primerCobro: '5/8/2026' },
  ]

  for (const c of casos) {
    it(`${c.freq}: primer cobro el ${c.primerCobro}`, () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 5, diasPlazo: c.plazo,
        fechaInicio: '2026-07-05', frecuencia: c.freq, modoInteres: 'lineal',
      })
      expect(enBogota(r.tablaAmortizacion[0].fechaEsperada)).toBe(c.primerCobro)
    })
  }

  it('da igual recibir el string del formulario o el Date que guarda la API', () => {
    for (const freq of ['diario', 'semanal', 'quincenal', 'mensual']) {
      const conString = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: '2026-07-05', frecuencia: freq, modoInteres: 'lineal',
      })
      const conDate = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: new Date('2026-07-05T05:00:00.000Z'), frecuencia: freq, modoInteres: 'lineal',
      })
      expect(
        conString.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada)),
        `frecuencia ${freq}`,
      ).toEqual(conDate.tablaAmortizacion.map((f) => enBogota(f.fechaEsperada)))
    }
  })
})

describe('la meta del dia en caja usa el mismo calendario que el proximo cobro', () => {
  // tienePeriodoEsperadoHoy alimenta el "esperado" de la caja. Si usara un
  // calendario distinto al de calcularProximoCobro, la caja le marcaria faltante
  // a un cobrador en un dia en que no tenia nada que cobrar.
  const hoyBogota = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' }))
  const diaDeHoy = hoyBogota.getDate()

  const prestamoBase = {
    estado: 'activo',
    cuotaDiaria: 500000,
    totalAPagar: 3000000,
    diasPlazo: 180,
    frecuencia: 'mensual',
    totalPagado: 0,
  }

  // ── POR QUÉ NO SON «3 MESES» FIJOS ──
  // Lo era, y la prueba se moría los días 29, 30 y 31: `Date.UTC(2026, 3, 31)`
  // es el 31 de ABRIL, que no existe, y JavaScript lo desborda al 1 de mayo.
  // El ancla dejaba de caer hoy y el fallo parecía del código de fechas cuando
  // era de la prueba. Se retrocede al primer mes en el que el día EXISTE.
  const mesesAtrasConMismoDia = () => {
    for (let k = 2; k <= 12; k += 1) {
      const d = new Date(Date.UTC(hoyBogota.getFullYear(), hoyBogota.getMonth() - k, diaDeHoy, 5))
      if (d.getUTCDate() === diaDeHoy) return d
    }
    throw new Error('ningun mes de los ultimos 12 tiene el dia ' + diaDeHoy)
  }

  it('hoy toca cobrar si el ancla implicito cae hoy', () => {
    // Unos meses atrás, el mismo día del mes que hoy
    const inicio = mesesAtrasConMismoDia()
    expect(tienePeriodoEsperadoHoy({ ...prestamoBase, fechaInicio: inicio }, false, [], [])).toBe(true)
  })

  it('un prestamo creado hoy NO suma a la meta de hoy', () => {
    const inicio = new Date(Date.UTC(hoyBogota.getFullYear(), hoyBogota.getMonth(), diaDeHoy, 5))
    expect(tienePeriodoEsperadoHoy({ ...prestamoBase, fechaInicio: inicio }, false, [], [])).toBe(false)
  })
})
