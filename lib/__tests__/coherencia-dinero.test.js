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

  /* ── LA CONTRADICCIÓN ────────────────────────────────────────────────────
     `calcularCapitalRestante` cobra TODO el interés primero: hasta que no se
     pagan los $100.000 de interés, el capital no baja un peso.

     `desglosarPago` —que está en el mismo archivo y NADIE USA— dice lo
     contrario: cada peso lleva su parte.

     Sobre la cartera real de producción esa diferencia son $227.817.311 en
     4.819 préstamos activos: un 9% del capital en la calle. */
  it('«capital restante» y «desglosarPago» NO coinciden, y hay que decidir cuál', () => {
    const cascada = calcularCapitalRestante(p)
    const proporcional = 500000 - desglosarPago({
      montoPagado: 300000, totalAPagar: 600000, montoPrestado: 500000,
    }).capital

    expect(cascada).toBe(300000)        // pagó 300k, pero 100k fueron interés
    expect(proporcional).toBe(250000)   // cada peso llevó su parte
    expect(cascada).not.toBe(proporcional)
  })

  /* ── LAS DOS CONVENCIONES, Y CUÁL GANA SIN PREGUNTAR ─────────────────────
     `calcularLiquidacionAnticipada` NO tiene una fórmula: devuelve DOS
     modalidades y deja elegir al prestamista, que es lo correcto porque en el
     gota a gota conviven las dos.

     El problema no es esa función: es que «capital restante» usa SIEMPRE la de
     mes completo, sin preguntar. Para el prestamista que prorratea, su capital
     en la calle sale inflado — $227.817.311 sobre la cartera real. */
  it('la liquidación ofrece las dos convenciones; el capital restante usa solo una', () => {
    const liq = calcularLiquidacionAnticipada(p, HOY)

    expect(liq.mesCompleto.interesDevengado).toBe(100000)   // cobra el mes entero
    expect(liq.mesCompleto.restanteHoy).toBe(300000)
    expect(liq.mesCompleto.interesPerdonado).toBe(0)

    expect(liq.proporcional.interesDevengado).toBe(50000)   // prorratea
    expect(liq.proporcional.restanteHoy).toBe(250000)
    expect(liq.proporcional.interesPerdonado).toBe(50000)

    // Y aquí está el punto: el capital restante coincide con UNA de las dos.
    expect(calcularCapitalRestante(p)).toBe(liq.mesCompleto.restanteHoy)
  })
})
