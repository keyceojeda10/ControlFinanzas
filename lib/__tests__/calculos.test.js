import { describe, it, expect, vi } from 'vitest'
import {
  calcularPrestamo,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  calcularDiasMora,
  calcularCapitalRestante,
  calcularEstadoCliente,
  tieneCobroPendienteHoy,
  formatFechaCobroRelativa,
  formatCOP,
  LIMITES_PLAN,
} from '../calculos'

describe('calcularPrestamo', () => {
  it('calculates daily loan correctly', () => {
    const r = calcularPrestamo({
      montoPrestado: 100000,
      tasaInteres: 20,
      diasPlazo: 30,
      fechaInicio: '2026-01-01',
      frecuencia: 'diario',
    })
    expect(r.totalAPagar).toBe(120000)
    expect(r.cuotaDiaria).toBe(4000) // 120000 / 30 = 4000 exacto
    expect(r.ultimaCuota).toBe(4000) // sin ajuste porque es exacto
    expect(r.totalInteres).toBe(20000)
    expect(r.frecuencia).toBe('diario')
  })

  it('calculates weekly loan correctly', () => {
    const r = calcularPrestamo({
      montoPrestado: 100000,
      tasaInteres: 10,
      diasPlazo: 28,
      fechaInicio: '2026-01-01',
      frecuencia: 'semanal',
    })
    // 28/30 meses × 10% × 100000 = 9333.33 → totalAPagar = 109333
    // 4 semanas → cuota base 27333.25 → floor a 27300
    // ultima = 109333 - 27300×3 = 27433
    expect(r.totalAPagar).toBe(109333)
    expect(r.cuotaDiaria).toBe(27300)
    expect(r.ultimaCuota).toBe(109333 - 27300 * 3)
  })

  it('calculates fechaFin correctly', () => {
    const r = calcularPrestamo({
      montoPrestado: 50000,
      tasaInteres: 15,
      diasPlazo: 20,
      fechaInicio: '2026-03-01',
    })
    const fechaFin = new Date(r.fechaFin)
    expect(fechaFin.toISOString().slice(0, 10)).toBe('2026-03-21')
  })

  it('handles 0% interest', () => {
    const r = calcularPrestamo({
      montoPrestado: 100000,
      tasaInteres: 0,
      diasPlazo: 10,
      fechaInicio: '2026-01-01',
    })
    expect(r.totalAPagar).toBe(100000)
    expect(r.totalInteres).toBe(0)
    expect(r.cuotaDiaria).toBe(10000)
    expect(r.ultimaCuota).toBe(10000)
  })

  it('rounds cuota to multiples of 50 and adjusts last cuota', () => {
    // 500000 al 10% por 30 dias = 550000 total
    // 30 cuotas → base 18333.33 → floor a 18300
    // ultima = 550000 - 18300×29 = 19300
    const r = calcularPrestamo({
      montoPrestado: 500000,
      tasaInteres: 10,
      diasPlazo: 30,
      fechaInicio: '2026-01-01',
    })
    expect(r.totalAPagar).toBe(550000)
    expect(r.cuotaDiaria).toBe(18300)
    expect(r.ultimaCuota).toBe(550000 - 18300 * 29)
    expect(r.cuotaDiaria * 29 + r.ultimaCuota).toBe(r.totalAPagar)
  })

  it('totalAPagar = cuotas normales + ultima cuota', () => {
    const r = calcularPrestamo({
      montoPrestado: 300000,
      tasaInteres: 15,
      diasPlazo: 45,
      fechaInicio: '2026-01-01',
    })
    expect(r.cuotaDiaria * (r.numPeriodos - 1) + r.ultimaCuota).toBe(r.totalAPagar)
  })
})

describe('calcularSaldoPendiente', () => {
  it('returns full amount when no payments', () => {
    const saldo = calcularSaldoPendiente({ totalAPagar: 120000, pagos: [] })
    expect(saldo).toBe(120000)
  })

  it('subtracts normal payments', () => {
    const saldo = calcularSaldoPendiente({
      totalAPagar: 120000,
      pagos: [
        { montoPagado: 4000, tipo: 'completo' },
        { montoPagado: 4000, tipo: 'parcial' },
      ],
    })
    expect(saldo).toBe(112000)
  })

  it('ignores recargo and descuento in sum', () => {
    const saldo = calcularSaldoPendiente({
      totalAPagar: 120000,
      pagos: [
        { montoPagado: 10000, tipo: 'completo' },
        { montoPagado: 5000, tipo: 'recargo' },
        { montoPagado: 3000, tipo: 'descuento' },
      ],
    })
    expect(saldo).toBe(110000) // only 10000 subtracted
  })

  it('never returns negative', () => {
    const saldo = calcularSaldoPendiente({
      totalAPagar: 10000,
      pagos: [{ montoPagado: 15000, tipo: 'completo' }],
    })
    expect(saldo).toBe(0)
  })

  it('handles null/undefined pagos', () => {
    expect(calcularSaldoPendiente({ totalAPagar: 50000 })).toBe(50000)
    expect(calcularSaldoPendiente({ totalAPagar: 50000, pagos: null })).toBe(50000)
  })
})

describe('calcularPorcentajePagado', () => {
  it('returns 0 when no payments', () => {
    expect(calcularPorcentajePagado({ totalAPagar: 100000, pagos: [] })).toBe(0)
  })

  it('calculates percentage correctly', () => {
    expect(calcularPorcentajePagado({
      totalAPagar: 100000,
      pagos: [{ montoPagado: 50000, tipo: 'completo' }],
    })).toBe(50)
  })

  it('caps at 100%', () => {
    expect(calcularPorcentajePagado({
      totalAPagar: 10000,
      pagos: [{ montoPagado: 15000, tipo: 'completo' }],
    })).toBe(100)
  })

  it('returns 0 when totalAPagar is 0', () => {
    expect(calcularPorcentajePagado({ totalAPagar: 0, pagos: [] })).toBe(0)
  })
})

describe('calcularCapitalRestante', () => {
  it('returns full amount when no capital payments', () => {
    expect(calcularCapitalRestante({
      montoPrestado: 100000,
      pagos: [{ montoPagado: 4000, tipo: 'completo' }],
    })).toBe(100000)
  })

  it('subtracts capital payments only', () => {
    expect(calcularCapitalRestante({
      montoPrestado: 100000,
      pagos: [
        { montoPagado: 20000, tipo: 'capital' },
        { montoPagado: 4000, tipo: 'completo' },
      ],
    })).toBe(80000)
  })

  it('never returns negative', () => {
    expect(calcularCapitalRestante({
      montoPrestado: 10000,
      pagos: [{ montoPagado: 15000, tipo: 'capital' }],
    })).toBe(0)
  })
})

describe('calcularEstadoCliente', () => {
  it('returns cancelado when no active loans', () => {
    expect(calcularEstadoCliente([])).toBe('cancelado')
    expect(calcularEstadoCliente([{ estado: 'completado' }])).toBe('cancelado')
  })

  it('returns activo when active loans with no mora', () => {
    // Loan just started today — no mora possible
    const hoy = new Date().toISOString()
    expect(calcularEstadoCliente([{
      estado: 'activo',
      fechaInicio: hoy,
      diasPlazo: 30,
      cuotaDiaria: 4000,
      frecuencia: 'diario',
      pagos: [],
    }])).toBe('activo')
  })

  it('respects non-collection days in status', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    const prestamo = {
      estado: 'activo',
      fechaInicio: '2026-04-08T05:00:00.000Z',
      diasPlazo: 30,
      cuotaDiaria: 10000,
      frecuencia: 'diario',
      pagos: [{ montoPagado: 30000, tipo: 'completo' }],
    }

    expect(calcularEstadoCliente([prestamo], [])).toBe('mora')
    expect(calcularEstadoCliente([prestamo], [0])).toBe('activo')

    mockNow.mockRestore()
  })
})

describe('calcularDiasMora', () => {
  it('returns 0 for completed loans', () => {
    expect(calcularDiasMora({ estado: 'completado' })).toBe(0)
  })

  it('returns 0 when loan has not started yet', () => {
    const futuro = new Date()
    futuro.setDate(futuro.getDate() + 10)
    expect(calcularDiasMora({
      estado: 'activo',
      fechaInicio: futuro.toISOString(),
      diasPlazo: 30,
      cuotaDiaria: 4000,
      frecuencia: 'diario',
      pagos: [],
    })).toBe(0)
  })

  it('returns 0 when cuotaDiaria is 0', () => {
    expect(calcularDiasMora({
      estado: 'activo',
      fechaInicio: '2020-01-01',
      diasPlazo: 30,
      cuotaDiaria: 0,
      frecuencia: 'diario',
      pagos: [],
    })).toBe(0)
  })

  it('recalculates mora when adding a non-collection day', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    const prestamo = {
      estado: 'activo',
      fechaInicio: '2026-04-08T05:00:00.000Z',
      diasPlazo: 30,
      cuotaDiaria: 10000,
      frecuencia: 'diario',
      pagos: [{ montoPagado: 30000, tipo: 'completo' }],
    }

    expect(calcularDiasMora(prestamo, [])).toBe(1)
    expect(calcularDiasMora(prestamo, [0])).toBe(0) // domingo excluido

    mockNow.mockRestore()
  })

  it('keeps increasing mora after due date is far in the past', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    const prestamo = {
      estado: 'activo',
      fechaInicio: '2026-03-01T05:00:00.000Z',
      diasPlazo: 30,
      cuotaDiaria: 4000,
      frecuencia: 'diario',
      totalAPagar: 120000,
      pagos: [{ montoPagado: 100000, tipo: 'completo' }],
    }

    expect(calcularDiasMora(prestamo, [])).toBe(17)

    mockNow.mockRestore()
  })
})

describe('formatFechaCobroRelativa', () => {
  it('formats today, tomorrow and yesterday labels in Colombia timezone', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    expect(formatFechaCobroRelativa('2026-04-13T05:00:00.000Z')).toBe('Hoy')
    expect(formatFechaCobroRelativa('2026-04-14T05:00:00.000Z')).toBe('Mañana')
    expect(formatFechaCobroRelativa('2026-04-12T05:00:00.000Z')).toBe('Ayer')

    mockNow.mockRestore()
  })
})

describe('tieneCobroPendienteHoy', () => {
  it('returns false when today expected amount is fully covered', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    const prestamo = {
      estado: 'activo',
      fechaInicio: '2026-04-10T05:00:00.000Z',
      diasPlazo: 30,
      cuotaDiaria: 10000,
      frecuencia: 'diario',
      totalAPagar: 300000,
      pagos: [{ montoPagado: 30000, tipo: 'completo' }],
    }

    expect(tieneCobroPendienteHoy(prestamo, [])).toBe(false)

    mockNow.mockRestore()
  })

  it('returns true when there is still shortfall for today', () => {
    const mockNow = vi.spyOn(Date, 'now').mockReturnValue(new Date('2026-04-13T17:00:00.000Z').getTime())

    const prestamo = {
      estado: 'activo',
      fechaInicio: '2026-04-10T05:00:00.000Z',
      diasPlazo: 30,
      cuotaDiaria: 10000,
      frecuencia: 'diario',
      totalAPagar: 300000,
      pagos: [{ montoPagado: 25000, tipo: 'completo' }],
    }

    expect(tieneCobroPendienteHoy(prestamo, [])).toBe(true)

    mockNow.mockRestore()
  })
})

describe('formatCOP', () => {
  it('formats positive values', () => {
    expect(formatCOP(100000)).toMatch(/\$100/)
  })

  it('handles null/undefined', () => {
    expect(formatCOP(null)).toBe('$0')
    expect(formatCOP(undefined)).toBe('$0')
  })
})

describe('LIMITES_PLAN', () => {
  it('has correct limits', () => {
    expect(LIMITES_PLAN.basic).toBe(50)
    expect(LIMITES_PLAN.standard).toBe(300)
    expect(LIMITES_PLAN.professional).toBe(Infinity)
  })
})
