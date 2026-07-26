import { describe, it, expect } from 'vitest'
import { calcularCapitalRestante, recalcularTablaSoloInteresDesdeSaldo } from '../calculos'

// Tabla de un globo (solo_interes adelantado): filas 1..n-1 solo interes,
// fila n solo capital (balloon).
function tablaGlobo(capital, tasaPct, periodos) {
  const interes = Math.round(capital * (tasaPct / 100))
  const filas = []
  for (let n = 1; n <= periodos; n++) {
    const esUltimo = n === periodos
    filas.push({
      numeroPeriodo: n,
      capital: esUltimo ? capital : 0,
      interes: esUltimo ? 0 : interes,
      cuotaTotal: esUltimo ? capital : interes,
      pagado: 0,
      interesPagado: 0,
      saldoRestante: esUltimo ? 0 : capital,
    })
  }
  return filas
}

const CASO = { modoInteres: 'solo_interes', frecuencia: 'mensual' }

describe('abono a capital en globo (caso Judith: 4.5M al 5%, abona 3M)', () => {
  it('el abono a capital NO se reparte primero en intereses (baja capital directo)', () => {
    // Antes del abono la tabla es de origen (balloon 4.5M, interes 225k).
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [{ tipo: 'capital', montoPagado: 3_000_000 }],
      totalPagado: 3_000_000,
    }
    // El abono se excluye de la cascada -> capital "antes de aplicarlo" = 4.5M
    // (NO 3.975M como daba el bug, que se comia 11 meses de interes).
    expect(calcularCapitalRestante(prestamo)).toBe(4_500_000)
  })

  it('capital tras el abono = 1.5M y el interes recalcula a 75k', () => {
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [{ tipo: 'capital', montoPagado: 3_000_000 }],
      totalPagado: 3_000_000,
    }
    const capitalAntes = calcularCapitalRestante(prestamo)
    const saldoCapitalRestante = capitalAntes - 3_000_000
    expect(saldoCapitalRestante).toBe(1_500_000)

    const tabla = recalcularTablaSoloInteresDesdeSaldo({
      saldoInicial: saldoCapitalRestante,
      tasaInteres: 5,
      numPeriodosRestantes: 12,
      primerNumeroPeriodo: 1,
      fechaBase: new Date('2026-07-01T00:00:00Z'),
      diasPeriodo: 30,
      interesAdelantado: true,
    })
    // Cuotas de interes = 75.000; balloon final = 1.500.000
    expect(tabla[0].interes).toBe(75_000)
    expect(tabla[10].interes).toBe(75_000)
    expect(tabla[11].capital).toBe(1_500_000)
    expect(tabla[11].interes).toBe(0) // adelantado: la ultima es solo capital
  })

  it('tras regenerar la tabla, el capital restante se lee 1.5M (no 0)', () => {
    // Tabla YA regenerada (balloon 1.5M, interes 75k) + el abono sigue en pagos.
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(1_500_000, 5, 12),
      pagos: [{ tipo: 'capital', montoPagado: 3_000_000 }],
      totalPagado: 3_000_000,
    }
    // El abono NO se resta otra vez (ya esta en el balloon reducido).
    expect(calcularCapitalRestante(prestamo)).toBe(1_500_000)
  })
})

describe('regresion: un pago normal SI usa la cascada interes-primero', () => {
  it('completo/parcial cubre interes antes que capital', () => {
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [{ tipo: 'completo', montoPagado: 225_000 }],
      totalPagado: 225_000,
    }
    // 225k cubre el interes de la 1a cuota, 0 al capital -> capital sigue 4.5M
    expect(calcularCapitalRestante(prestamo)).toBe(4_500_000)
  })

  it('sin abonos a capital el resultado no cambia (no-op del fix)', () => {
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [],
      totalPagado: 0,
    }
    expect(calcularCapitalRestante(prestamo)).toBe(4_500_000)
  })
})
