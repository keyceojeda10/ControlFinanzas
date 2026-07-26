import { describe, it, expect } from 'vitest'
import { calcularDiasMora, calcularMontoEnMora } from '../calculos'

// Globo adelantado: el capital final (balloon) tiene interes=0. Antes eso hacia
// que "interesAlDia" fuera siempre true y el capital vencido/sin pagar NUNCA
// entraba en mora: el cliente aparecia "al dia" debiendo TODO el capital.

const balloonVencido = {
  estado: 'activo',
  fechaInicio: new Date('2020-01-01T05:00:00Z'),
  cuotaDiaria: 100000,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  interesAdelantado: true,
  diasPlazo: 90,
  totalAPagar: 1_200_000,
  totalPagado: 200_000, // pago los 2 periodos de interes
  pagos: [{ tipo: 'intereses', montoPagado: 200_000 }],
  cuotasAmortizacion: [
    { numeroPeriodo: 1, capital: 0, interes: 100000, cuotaTotal: 100000, pagado: 0, interesPagado: 100000, fechaEsperada: new Date('2020-02-01T05:00:00Z'), saldoRestante: 1000000 },
    { numeroPeriodo: 2, capital: 0, interes: 100000, cuotaTotal: 100000, pagado: 0, interesPagado: 100000, fechaEsperada: new Date('2020-03-01T05:00:00Z'), saldoRestante: 1000000 },
    { numeroPeriodo: 3, capital: 1000000, interes: 0, cuotaTotal: 1000000, pagado: 0, interesPagado: 0, fechaEsperada: new Date('2020-04-01T05:00:00Z'), saldoRestante: 0 },
  ],
}

describe('globo adelantado: balloon vencido SI entra en mora', () => {
  it('dias de mora > 0 (antes daba 0)', () => {
    expect(calcularDiasMora(balloonVencido)).toBeGreaterThan(0)
  })
  it('monto en mora = el capital del balloon (topado al saldo)', () => {
    expect(calcularMontoEnMora(balloonVencido)).toBe(1_000_000)
  })
})

describe('globo adelantado al dia: sin mora', () => {
  it('con el balloon aun en el futuro, mora = 0', () => {
    const alDia = {
      ...balloonVencido,
      fechaInicio: new Date('2999-01-01T05:00:00Z'),
      cuotasAmortizacion: balloonVencido.cuotasAmortizacion.map((f) => ({
        ...f, fechaEsperada: new Date('2999-06-01T05:00:00Z'),
      })),
    }
    expect(calcularDiasMora(alDia)).toBe(0)
  })
})
