import { describe, it, expect } from 'vitest'
import { capitalVivoSegunTabla, calcularCapitalRestante, recalcularTablaSoloInteresDesdeSaldo } from '../calculos'

// ⚠ Estas pruebas interrogan `capitalVivoSegunTabla`, NO `calcularCapitalRestante`.
//
// Son dos preguntas distintas y vivian en la misma funcion:
//
//   capitalVivoSegunTabla    lo que dice la TABLA, ignorando los abonos a
//                            capital (ya horneados en ella). Es lo que necesita
//                            el flujo que registra el abono, porque el resta el
//                            abono el mismo antes de regenerar.
//   calcularCapitalRestante  cuanto de tu plata sigue afuera, para REPORTAR.
//                            Ahi los abonos si cuentan.
//
// Al unificar la cifra de reporte estuve a punto de cambiar la que usa el flujo
// de escritura. El abono se habria restado DOS VECES y el globo se habria
// encogido de mas: deuda perdonada sin que nadie lo decida. Lo cazaron estas
// pruebas, que por eso se quedan pegadas al contrato de escritura.

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
    expect(capitalVivoSegunTabla(prestamo)).toBe(4_500_000)
  })

  it('capital tras el abono = 1.5M y el interes recalcula a 75k', () => {
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [{ tipo: 'capital', montoPagado: 3_000_000 }],
      totalPagado: 3_000_000,
    }
    const capitalAntes = capitalVivoSegunTabla(prestamo)
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
    expect(capitalVivoSegunTabla(prestamo)).toBe(1_500_000)
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
    expect(capitalVivoSegunTabla(prestamo)).toBe(4_500_000)
  })

  it('sin abonos a capital el resultado no cambia (no-op del fix)', () => {
    const prestamo = {
      ...CASO,
      cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12),
      pagos: [],
      totalPagado: 0,
    }
    expect(capitalVivoSegunTabla(prestamo)).toBe(4_500_000)
  })
})

describe('las dos preguntas, y por que no pueden ser la misma funcion', () => {
  // Globo de 4.5M al 5%, con un abono de 3M ya aplicado y la tabla YA
  // regenerada al balloon de 1.5M.
  const prestamo = {
    ...CASO,
    montoPrestado: 4_500_000,
    totalAPagar: 4_500_000 + 225_000 * 11,
    cuotasAmortizacion: tablaGlobo(1_500_000, 5, 12),
    pagos: [{ tipo: 'capital', montoPagado: 3_000_000 }],
    totalPagado: 3_000_000,
  }

  it('la de ESCRIBIR ignora el abono: la tabla ya lo lleva dentro', () => {
    expect(capitalVivoSegunTabla(prestamo)).toBe(1_500_000)
  })

  it('la de REPORTAR tambien llega a 1.5M, por el otro camino', () => {
    // 4.5M prestados - 3M de abono que volvio = 1.5M en la calle.
    expect(calcularCapitalRestante(prestamo)).toBe(1_500_000)
  })

  it('pero ANTES de regenerar la tabla se separan, y ahi esta el peligro', () => {
    const sinRegenerar = { ...prestamo, cuotasAmortizacion: tablaGlobo(4_500_000, 5, 12) }
    // La de escribir dice 4.5M: es el capital ANTES del abono, y el flujo le
    // resta los 3M para regenerar sobre 1.5M.
    expect(capitalVivoSegunTabla(sinRegenerar)).toBe(4_500_000)
    // La de reportar ya descuenta el abono. Si el flujo usara esta, restaria
    // los 3M otra vez y regeneraria sobre -1.5M -> 0. Deuda perdonada.
    expect(calcularCapitalRestante(sinRegenerar)).toBe(1_500_000)
  })
})
