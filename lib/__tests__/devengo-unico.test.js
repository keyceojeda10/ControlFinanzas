// lib/__tests__/devengo-unico.test.js
//
// La curva de devengo de cuota única, y la guardia que protege la decisión.
//
// DECIDIDO el 2 de agosto de 2026, con las cifras del espejo delante:
//   · lineal por días
//   · SOLO MIDE — no cambia lo que el cliente paga si cancela antes
//
// La segunda mitad es la que más falta hacía escribir. Si la curva tocara el
// cobro movería $59.886.827 en 734 préstamos vivos, así que la última prueba de
// este archivo existe para que nadie la enchufe a la liquidación sin volver a
// decidirlo — ni yo dentro de tres semanas.

import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { devengadoLineal } from '@/lib/dinero/tabla'
import { calcularLiquidacionAnticipada } from '@/lib/calculos'

// $1.000.000 al 20%, 40 días de plazo: $200.000 de interés pactado.
const p = {
  montoPrestado: 1000000,
  totalAPagar: 1200000,
  modoInteres: 'unico',
  // Hace falta de verdad: `interesPara` en cuota única sale de la TASA
  // (`capital * tasa/100`), no de `totalAPagar - montoPrestado`. Sin ella la
  // liquidación devolvía 0 y la guardia pasaba por el motivo equivocado.
  tasaInteres: 20,
  frecuencia: 'diario',
  diasPlazo: 40,
  fechaInicio: '2026-08-01T05:00:00Z',
  fechaFin: '2026-09-10T05:00:00Z',
  pagos: [],
  cuotasAmortizacion: [],
}

describe('la curva de cuota única corre por días', () => {
  it('el día del desembolso no se ha ganado nada', () => {
    expect(devengadoLineal(p, '2026-08-01T05:00:00Z')).toBe(0)
  })

  it('a la mitad del plazo va la mitad del interés', () => {
    // 20 de 40 días. Es la frase que el prestamista puede decir por teléfono.
    expect(devengadoLineal(p, '2026-08-21T05:00:00Z')).toBe(100000)
  })

  it('a un cuarto va un cuarto', () => {
    expect(devengadoLineal(p, '2026-08-11T05:00:00Z')).toBe(50000)
  })

  it('al vencimiento está TODO el interés pactado, ni un peso más', () => {
    expect(devengadoLineal(p, '2026-09-10T05:00:00Z')).toBe(200000)
  })

  it('pasado el vencimiento NO sigue creciendo solo', () => {
    // El interés no engorda por su cuenta: para eso está el recargo, que es
    // otra cosa y la decide el prestamista. Ver `plazo_no_es_tope`.
    expect(devengadoLineal(p, '2026-12-31T05:00:00Z')).toBe(200000)
  })

  it('antes del desembolso no devuelve negativo', () => {
    expect(devengadoLineal(p, '2026-07-01T05:00:00Z')).toBe(0)
  })

  it('sin interés pactado no inventa devengo', () => {
    expect(devengadoLineal({ ...p, totalAPagar: 1000000 }, '2026-08-21T05:00:00Z')).toBe(0)
  })

  it('sin fechaFin cae al plazo en días y sigue funcionando', () => {
    const sinFin = { ...p, fechaFin: null }
    expect(devengadoLineal(sinFin, '2026-08-21T05:00:00Z')).toBe(100000)
  })
})

describe('LA GUARDIA · la curva NO toca lo que el cliente paga', () => {
  it('liquidar a mitad de plazo sigue costando lo mismo que antes', () => {
    // Lo pactado sigue siendo lo pactado. Si esta prueba se pone roja, alguien
    // enchufó la curva al cobro — y eso es una decisión con consentimiento
    // cliente por cliente (G8), no un cambio de fórmula.
    const liq = calcularLiquidacionAnticipada(p, { fechaLiquidacion: '2026-08-21T05:00:00Z' })
    const modalidad = liq?.proporcional ?? liq?.mesCompleto ?? liq
    expect(modalidad.interesDevengado).toBe(200000)
    expect(modalidad.interesPerdonado).toBe(0)
  })

  it('el devengo lineal y el de la liquidación NO coinciden, y es a propósito', () => {
    const liq = calcularLiquidacionAnticipada(p, { fechaLiquidacion: '2026-08-21T05:00:00Z' })
    const modalidad = liq?.proporcional ?? liq?.mesCompleto ?? liq
    expect(devengadoLineal(p, '2026-08-21T05:00:00Z')).toBe(100000)
    expect(modalidad.interesDevengado).toBe(200000)
  })

  it('`devengadoLineal` no aparece en calculos.js', () => {
    // La guardia estructural: mientras no se importe ahí, no puede afectar al
    // cobro por descuido. Es el mismo género que la prueba que impide que
    // vuelvan a aparecer copias del reparto.
    const fuente = fs.readFileSync(path.join(process.cwd(), 'lib/calculos.js'), 'utf8')
    expect(fuente).not.toContain('devengadoLineal')
  })
})
