// ¿Dicen lo mismo las cifras de dinero del mismo préstamo?
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// Una cifra sola siempre parece razonable. Lo que delata un error es que DOS
// pantallas del mismo préstamo no cuadren entre sí. Esta prueba no comprueba
// una fórmula contra sí misma: comprueba unas contra otras.
//
// El caso es el corriente de un gota a gota: $500.000 al 20%, 30 cobros diarios
// de $20.000. A mitad de plazo, con la mitad pagada.

import { describe, it, expect } from 'vitest'
import {
  calcularCapitalRestante,
  calcularSaldoPendiente,
  calcularLiquidacionAnticipada,
  desglosarPago,
} from '../calculos'
import { capitalEnCalle, porGanar } from '../dinero/reparto'

const INICIO = new Date('2026-07-01T05:00:00Z')
const HOY = new Date(INICIO.getTime() + 15 * 86400000)

function prestamoAMitad() {
  const pagos = []
  for (let i = 1; i <= 15; i++) {
    pagos.push({
      tipo: 'completo',
      montoPagado: 20000,
      fechaPago: new Date(INICIO.getTime() + i * 86400000),
    })
  }
  return {
    montoPrestado: 500000,
    totalAPagar: 600000,
    cuotaDiaria: 20000,
    diasPlazo: 30,
    frecuencia: 'diario',
    modoInteres: 'fijo',
    tasaInteres: 20,
    fechaInicio: INICIO,
    totalPagado: 300000,
    pagos,
    estado: 'activo',
  }
}

describe('las cifras del mismo préstamo, unas contra otras', () => {
  const p = prestamoAMitad()

  it('el saldo pendiente es lo que falta del total pactado', () => {
    expect(calcularSaldoPendiente(p)).toBe(300000)
  })

  /* ── LA CONTRADICCIÓN, Y CÓMO SE RESOLVIÓ ────────────────────────────────
     Aquí había DOS respuestas a la misma pregunta, en el mismo archivo:

       `calcularCapitalRestante`  cobraba TODO el interés primero. Hasta que no
                                  entraran los $100.000, el capital no bajaba
                                  un peso → $300.000
       `desglosarPago`            cada peso lleva su parte → $250.000

     Medido sobre la cartera real: **$264.614.219** de diferencia en «capital en
     la calle», la cifra con la que el prestamista decide si puede prestar más.

     Resuelto el 1 ago 2026 a favor del PROPORCIONAL. Esta prueba ya no
     documenta una contradicción: documenta que dejó de haberla, y falla si
     alguien vuelve a separarlas. */
  it('las dos formas de repartir dicen YA lo mismo', () => {
    const porCapitalRestante = calcularCapitalRestante(p)
    const porDesglose = 500000 - desglosarPago({
      montoPagado: 300000, totalAPagar: 600000, montoPrestado: 500000,
    }).capital
    const porElModulo = capitalEnCalle(p)

    expect(porCapitalRestante).toBe(250000)
    expect(porDesglose).toBe(250000)
    expect(porElModulo).toBe(250000)
  })

  /* ── LIQUIDAR ES OTRA PREGUNTA, Y SIGUE OFRECIENDO LAS DOS ───────────────
     `calcularLiquidacionAnticipada` NO tiene una fórmula: devuelve DOS
     modalidades y deja elegir al prestamista. Eso está BIEN y se queda: «qué
     debe si cierra hoy» es una negociación, y en el gota a gota conviven las
     dos costumbres.

     Lo que estaba mal era otra cosa: «capital en la calle» —que NO es una
     negociación, es un dato— usaba una de las dos sin preguntar. Ya no. */
  it('la liquidación sigue ofreciendo las dos, porque cerrar SÍ se negocia', () => {
    const liq = calcularLiquidacionAnticipada(p, HOY)

    expect(liq.mesCompleto.interesDevengado).toBe(100000)   // cobra el mes entero
    expect(liq.mesCompleto.restanteHoy).toBe(300000)
    expect(liq.mesCompleto.interesPerdonado).toBe(0)

    expect(liq.proporcional.interesDevengado).toBe(50000)   // prorratea
    expect(liq.proporcional.restanteHoy).toBe(250000)
    expect(liq.proporcional.interesPerdonado).toBe(50000)
  })

  /* ── LA IDENTIDAD, que ahora se cumple ───────────────────────────────────
     La ficha de ruta parte la cartera en «lo puesto» y «lo que falta por
     ganar». Con la cascada eso no cerraba. */
  it('capital en la calle + por ganar = lo que falta cobrar', () => {
    expect(capitalEnCalle(p) + porGanar(p)).toBe(calcularSaldoPendiente(p))
  })
})

/* ── EL CASO QUE VOLVÍA A SEPARARLAS: COBRAR MENOS DE LO PRESTADO ──────────
   850 préstamos en producción tienen `totalAPagar < montoPrestado` (758 de
   ellos cerrados exactamente en lo cobrado). Ahí las dos funciones volvían a
   contestar distinto —$1.547.682 contra $1.230.000 sobre el mismo préstamo—
   porque una acotaba la fracción y la otra no, y solo una topaba por el saldo.

   Es el mismo pecado con otra ropa: dos respuestas bajo un rótulo. */
describe('cobró menos de lo que prestó: las dos siguen diciendo lo mismo', () => {
  const enPerdidaActivo = {
    montoPrestado: 1900000,
    totalAPagar: 1510000,
    totalPagado: 280000,
    modoInteres: 'fijo',
    pagos: [],
    estado: 'activo',
  }
  const enPerdidaCerrado = {
    montoPrestado: 1500000,
    totalAPagar: 900000,
    totalPagado: 900000,
    modoInteres: 'fijo',
    pagos: [],
    estado: 'completado',
  }

  it('activo: nunca más capital vivo del que falta por cobrar', () => {
    const saldo = calcularSaldoPendiente(enPerdidaActivo)   // 1.230.000
    expect(capitalEnCalle(enPerdidaActivo)).toBe(saldo)
    expect(calcularCapitalRestante(enPerdidaActivo)).toBe(saldo)
  })

  it('cerrado: no queda nada en la calle por ninguno de los dos caminos', () => {
    expect(capitalEnCalle(enPerdidaCerrado)).toBe(0)
    expect(calcularCapitalRestante(enPerdidaCerrado)).toBe(0)
  })

  it('y no se reconoce interés que nunca se cobró', () => {
    expect(desglosarPago({
      montoPagado: 900000, totalAPagar: 900000, montoPrestado: 1500000,
    })).toEqual({ interes: 0, capital: 900000 })
  })

  it('la identidad aguanta también aquí', () => {
    for (const q of [enPerdidaActivo, enPerdidaCerrado]) {
      expect(capitalEnCalle(q) + porGanar(q)).toBe(calcularSaldoPendiente(q))
    }
  })
})

/* ── LA REJILLA: las dos funciones, en TODOS los casos ─────────────────────
   Fijar la igualdad en un préstamo bonito no prueba nada: los tres sitios
   donde se separaron fueron los casos raros —con tabla, con abono a capital,
   cobrado por debajo de lo prestado—. En el de la tabla usaban aritmética
   distinta (`Σ fila.capital` contra `montoPrestado`, y una sin topar por el
   saldo) y daban $559.999 de diferencia sobre un negocio real. */
describe('calcularCapitalRestante y capitalEnCalle, en toda la rejilla', () => {
  const TABLA = [
    { numeroPeriodo: 1, capital: 25000, interes: 15000, cuotaTotal: 40000 },
    { numeroPeriodo: 2, capital: 25000, interes: 10000, cuotaTotal: 35000 },
    { numeroPeriodo: 3, capital: 25000, interes: 5000, cuotaTotal: 30000 },
    { numeroPeriodo: 4, capital: 25000, interes: 0, cuotaTotal: 25000 },
  ]

  const CASOS = []
  for (const [monto, total] of [[500000, 600000], [100000, 130000], [1500000, 900000], [100000, 100000]]) {
    for (const pagado of [0, 1, 40000, Math.round(total / 2), total, total + 5000]) {
      for (const abono of [0, 30000]) {
        CASOS.push({
          nombre: `${monto}/${total} · pagado ${pagado} · abono ${abono}`,
          modoInteres: 'fijo', montoPrestado: monto, totalAPagar: total, totalPagado: pagado,
          pagos: abono ? [{ tipo: 'capital', montoPagado: abono }] : [],
        })
        CASOS.push({
          nombre: `CON TABLA ${monto}/${total} · pagado ${pagado} · abono ${abono}`,
          modoInteres: 'lineal', montoPrestado: monto, totalAPagar: total, totalPagado: pagado,
          pagos: abono ? [{ tipo: 'capital', montoPagado: abono }] : [],
          cuotasAmortizacion: TABLA,
        })
      }
    }
  }

  it(`las dos dicen lo mismo en los ${CASOS.length} casos`, () => {
    for (const c of CASOS) {
      expect(calcularCapitalRestante(c), c.nombre).toBe(capitalEnCalle(c))
    }
  })

  it('ninguna se pasa nunca del saldo pendiente', () => {
    for (const c of CASOS) {
      expect(capitalEnCalle(c), c.nombre).toBeLessThanOrEqual(calcularSaldoPendiente(c))
    }
  })

  it('y la identidad se cumple en los mismos casos', () => {
    for (const c of CASOS) {
      expect(capitalEnCalle(c) + porGanar(c), c.nombre).toBe(calcularSaldoPendiente(c))
    }
  })
})
