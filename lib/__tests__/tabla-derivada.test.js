// lib/__tests__/tabla-derivada.test.js
//
// G6.1 · La tabla derivada, contra `calcularPrestamo` DE VERDAD.
//
// El plan lo marca como el primer test y como requisito no negociable: «la
// tabla derivada tiene que reproducir el redondeo real (ceil100) o no sumará
// totalAPagar».
//
// Por eso aquí NO se comprueba mi aritmética contra sí misma —el error que ya
// costó catorce pruebas verdes con las filas de «Necesita tu atención» saliendo
// vacías—. Se llama a `calcularPrestamo`, se toma lo que produce, y se exige
// que la tabla derivada cuadre con ESO.

import { describe, it, expect } from 'vitest'
import { calcularPrestamo } from '@/lib/calculos'
import {
  derivarTabla, tablaDe, sePuedeDerivar, numeroDeCuotas, interesDevengadoA,
} from '@/lib/dinero/tabla'

/** Un préstamo como lo guarda la base, a partir de lo que calcula la app. */
function prestamoReal({ monto, tasa, dias, frecuencia, modoInteres = 'fijo' }) {
  const calc = calcularPrestamo({
    montoPrestado: monto, tasaInteres: tasa, diasPlazo: dias,
    frecuencia, modoInteres, fechaInicio: '2026-08-01T05:00:00Z',
  })
  return {
    montoPrestado: monto,
    totalAPagar: calc.totalAPagar,
    totalCuotas: calc.numeroCuotas ?? calc.totalCuotas,
    diasPlazo: dias,
    frecuencia,
    modoInteres,
    fechaInicio: '2026-08-01T05:00:00Z',
    cuotasAmortizacion: [],
    _calc: calc,
  }
}

// Rejilla: los modos SIN tabla, en las cuatro frecuencias, con montos que
// obligan al redondeo a hacer algo (no divisibles por el número de cuotas).
const CASOS = []
for (const modoInteres of ['fijo', 'unico', 'manual']) {
  for (const [frecuencia, dias] of [['diario', 30], ['semanal', 84], ['quincenal', 90], ['mensual', 180]]) {
    for (const monto of [1000000, 1500000, 333333, 750500]) {
      for (const tasa of [10, 20, 7.5]) {
        CASOS.push({ monto, tasa, dias, frecuencia, modoInteres })
      }
    }
  }
}

describe('G6.1 · la tabla derivada cuadra con lo que la app ya calculó', () => {
  it(`la rejilla cubre los 3 modos sin tabla x 4 frecuencias (${CASOS.length} casos)`, () => {
    expect(CASOS.length).toBe(144)
  })

  it('la rejilla prueba lo que cree: el número de filas es el de cobros pactados', () => {
    // Sin esto, un `totalCuotas` indefinido caería al respaldo por `diasPlazo` y
    // las invariantes seguirían en verde SIN estar probando lo que digo. Ya me
    // pasó con los adaptadores: catorce pruebas verdes sobre filas vacías.
    const diario = prestamoReal({ monto: 1000000, tasa: 20, dias: 30, frecuencia: 'diario' })
    expect(derivarTabla(diario)).toHaveLength(30)

    const semanal = prestamoReal({ monto: 1000000, tasa: 20, dias: 84, frecuencia: 'semanal' })
    expect(derivarTabla(semanal)).toHaveLength(12)

    const mensual = prestamoReal({ monto: 1000000, tasa: 20, dias: 180, frecuencia: 'mensual' })
    expect(derivarTabla(mensual)).toHaveLength(6)

    const unico = prestamoReal({ monto: 1000000, tasa: 20, dias: 30, frecuencia: 'diario', modoInteres: 'unico' })
    expect(derivarTabla(unico)).toHaveLength(1)
  })

  it('INVARIANTE 1 · Σ cuotaTotal === totalAPagar, en los 144', () => {
    const fallos = []
    for (const caso of CASOS) {
      const p = prestamoReal(caso)
      const filas = derivarTabla(p)
      if (!filas.length) continue
      const suma = filas.reduce((a, f) => a + f.cuotaTotal, 0)
      if (suma !== p.totalAPagar) fallos.push({ ...caso, suma, total: p.totalAPagar })
    }
    expect(fallos).toEqual([])
  })

  it('INVARIANTE 2 · Σ capital === montoPrestado, en los 144', () => {
    const fallos = []
    for (const caso of CASOS) {
      const p = prestamoReal(caso)
      const filas = derivarTabla(p)
      if (!filas.length) continue
      const suma = filas.reduce((a, f) => a + f.capital, 0)
      if (suma !== p.montoPrestado) fallos.push({ ...caso, suma, monto: p.montoPrestado })
    }
    expect(fallos).toEqual([])
  })

  it('cada fila cuadra por dentro: capital + interes === cuotaTotal', () => {
    const fallos = []
    for (const caso of CASOS) {
      const filas = derivarTabla(prestamoReal(caso))
      for (const f of filas) {
        if (f.capital + f.interes !== f.cuotaTotal) fallos.push({ ...caso, fila: f.numeroPeriodo })
      }
    }
    expect(fallos).toEqual([])
  })

  it('el sobrante del redondeo cae en el INTERÉS, no en el capital', () => {
    // `calcularPrestamo` redondea la cuota hacia arriba a los $100, así que el
    // total lleva pesos de más. Ésos son ganancia: el capital es exactamente lo
    // que salió de la caja y no puede inflarse por un redondeo.
    const p = prestamoReal({ monto: 333333, tasa: 20, dias: 30, frecuencia: 'diario' })
    const filas = derivarTabla(p)
    expect(filas.reduce((a, f) => a + f.capital, 0)).toBe(333333)
    expect(filas.reduce((a, f) => a + f.interes, 0)).toBe(p.totalAPagar - 333333)
  })

  it('el saldo baja hasta cero exacto y nunca se va a negativo', () => {
    for (const caso of CASOS.slice(0, 24)) {
      const filas = derivarTabla(prestamoReal(caso))
      expect(filas[filas.length - 1].saldoRestante).toBe(0)
      expect(filas.every((f) => f.saldoRestante >= 0)).toBe(true)
    }
  })

  it('las fechas salen del MISMO calendario que usa la app al crear', () => {
    // `fechaDePeriodo` se extrajo del cierre de `calcularPrestamo` justo para
    // esto: si fueran dos calendarios distintos, se separarían con el tiempo.
    const p = prestamoReal({ monto: 1000000, tasa: 20, dias: 180, frecuencia: 'mensual' })
    const filas = derivarTabla(p)
    const ultima = filas[filas.length - 1].fechaEsperada
    expect(new Date(ultima).getTime()).toBe(new Date(p._calc.fechaFin).getTime())
  })
})

describe('cuándo NO se deriva', () => {
  it('un préstamo que YA tiene tabla guardada manda sobre la derivada', () => {
    // La guardada lleva horneados abonos y reprogramaciones que ninguna
    // derivación conoce. Derivar encima sería inventar.
    const guardada = [{ numeroPeriodo: 1, capital: 1, interes: 2, cuotaTotal: 3, fechaEsperada: '2026-08-02T05:00:00Z' }]
    const p = { ...prestamoReal({ monto: 1000000, tasa: 20, dias: 30, frecuencia: 'diario' }), cuotasAmortizacion: guardada }
    expect(sePuedeDerivar(p)).toBe(false)
    expect(tablaDe(p)).toEqual(guardada)
  })

  it('sin totalAPagar no se inventa una tabla', () => {
    expect(derivarTabla({ montoPrestado: 100000, totalAPagar: 0, totalCuotas: 10 })).toEqual([])
    expect(derivarTabla(null)).toEqual([])
  })

  it('`unico` es una sola cuota, y lleva todo el capital', () => {
    const p = prestamoReal({ monto: 500000, tasa: 20, dias: 30, frecuencia: 'diario', modoInteres: 'unico' })
    p.totalCuotas = 0   // como si la fila no lo trajera
    expect(numeroDeCuotas(p)).toBe(1)
    const filas = derivarTabla(p)
    expect(filas).toHaveLength(1)
    expect(filas[0].capital).toBe(500000)
  })
})

describe('el interés devengado — lo que el modo clásico no podía contestar', () => {
  const p = prestamoReal({ monto: 1000000, tasa: 20, dias: 30, frecuencia: 'diario' })
  const filas = derivarTabla(p)

  it('el día del desembolso todavía no se ha devengado nada', () => {
    expect(interesDevengadoA(filas, '2026-08-01T12:00:00Z')).toBe(0)
  })

  it('crece con el tiempo en vez de aparecer entero al final', () => {
    const aMitad = interesDevengadoA(filas, '2026-08-16T12:00:00Z')
    const alFinal = interesDevengadoA(filas, '2026-09-30T12:00:00Z')
    expect(aMitad).toBeGreaterThan(0)
    expect(aMitad).toBeLessThan(alFinal)
    // Al final está TODO el interés pactado, ni un peso más.
    expect(alFinal).toBe(p.totalAPagar - p.montoPrestado)
  })

  it('cuenta la cuota que vence HOY: ese interés ya se ganó', () => {
    const primera = filas[0].fechaEsperada
    expect(interesDevengadoA(filas, primera)).toBe(filas[0].interes)
  })
})
