import { describe, it, expect } from 'vitest'
import { calcularPrestamo, calcularGananciaNeta, desglosarPago } from '@/lib/calculos'

// GANANCIA: fija la definicion para que no vuelva a bifurcarse. El dashboard
// principal ya la tenia bien y la pantalla de analiticas habia quedado atras
// usando `recaudado - gastos`, que infla el numero varias veces.
describe('ganancia neta = interes cobrado - gastos', () => {
  it('recuperar capital propio NO es ganancia', () => {
    // $10M cobrados: $8M son capital que vuelve, $2M interes. Gastos $150k.
    expect(calcularGananciaNeta({ interesCobrado: 2000000, gastos: 150000 })).toBe(1850000)
    // La formula vieja habria dado 10.000.000 - 150.000 = 9.850.000
    expect(calcularGananciaNeta({ interesCobrado: 2000000, gastos: 150000 })).not.toBe(9850000)
  })

  it('puede ser negativa si hubo gastos y no se cobro interes', () => {
    expect(calcularGananciaNeta({ interesCobrado: 0, gastos: 150000 })).toBe(-150000)
  })

  it('el desglose de un pago siempre suma el monto pagado', () => {
    const casos = [
      { montoPagado: 120000, totalAPagar: 120000, montoPrestado: 100000 },
      { montoPagado: 33333,  totalAPagar: 250000, montoPrestado: 200000 },
      { montoPagado: 5000,   totalAPagar: 626079, montoPrestado: 500000 },
    ]
    for (const c of casos) {
      const { interes, capital } = desglosarPago(c)
      expect(interes + capital, JSON.stringify(c)).toBe(Math.round(c.montoPagado))
      expect(interes).toBeGreaterThanOrEqual(0)
      expect(capital).toBeGreaterThanOrEqual(0)
    }
  })

  it('sin interes pactado, todo el pago es capital', () => {
    expect(desglosarPago({ montoPagado: 50000, totalAPagar: 100000, montoPrestado: 100000 }))
      .toEqual({ interes: 0, capital: 50000 })
  })
})

// CUOTA INSUFICIENTE en Sobre saldo. Caso real reportado por un usuario externo:
// $7.500.907 al 1,8% mensual a 69 meses con cuota fijada en $110.700, cuando el
// interes del primer mes son $135.016. El sistema armaba una tabla con capital $0
// en 68 filas y una ultima cuota de $7.635.923 (total $15.163.523 contra $13,1M
// del frances real), sin advertir nada.
describe('sobre saldo: cuota que no cubre el interes', () => {
  const base = {
    montoPrestado: 7500907, tasaInteres: 1.8, diasPlazo: 69 * 30,
    fechaInicio: '2026-08-22', frecuencia: 'mensual', modoInteres: 'saldo',
  }

  it('la detecta y no arma tabla', () => {
    const r = calcularPrestamo({ ...base, cuotaManual: 110700 })
    expect(r.cuotaInsuficiente).toBe(true)
    expect(r.interesPrimerPeriodo).toBe(135016)
    expect(r.cuotaMinima).toBe(135017)
    expect(r.tablaAmortizacion).toEqual([])
  })

  it('la cuota sugerida SI amortiza y cierra el saldo en cero', () => {
    const { cuotaSugerida } = calcularPrestamo({ ...base, cuotaManual: 110700 })
    expect(cuotaSugerida).toBeGreaterThan(135016)

    const r = calcularPrestamo({ ...base, cuotaManual: cuotaSugerida })
    expect(r.cuotaInsuficiente).toBeUndefined()
    const ultima = r.tablaAmortizacion[r.tablaAmortizacion.length - 1]
    expect(ultima.saldoRestante).toBe(0)
    // y ninguna fila intermedia se queda sin amortizar capital
    expect(r.tablaAmortizacion.slice(0, -1).every(f => f.capital > 0)).toBe(true)
  })

  it('sin cuota manual nunca se marca insuficiente (la formula siempre amortiza)', () => {
    const r = calcularPrestamo(base)
    expect(r.cuotaInsuficiente).toBeUndefined()
    expect(r.tablaAmortizacion[r.tablaAmortizacion.length - 1].saldoRestante).toBe(0)
  })

  it('una cuota valida por encima del interes sigue funcionando', () => {
    const r = calcularPrestamo({ ...base, cuotaManual: 200000 })
    expect(r.cuotaInsuficiente).toBeUndefined()
    expect(r.tablaAmortizacion.length).toBeGreaterThan(0)
  })
})
