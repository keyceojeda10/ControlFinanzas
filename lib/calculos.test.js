// Tests exhaustivos para lib/calculos.js
// Cubre todos los modos de interes y todas las funciones de calculo.
//
// Para correr: npx vitest run lib/calculos.test.js
//
// Convenciones:
//   - Montos en COP (sin decimales)
//   - Fechas fijas para reproducibilidad (vi.useFakeTimers)
//   - Tolerancia de ±1 por redondeo: expect(v).toBeCloseTo(expected, -1)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  calcularPrestamo,
  calcularSaldoPendiente,
  calcularCapitalRestante,
  calcularDiasMora,
  calcularCuotasPendientes,
  calcularCuotasEnMora,
  calcularMontoEnMora,
  calcularMontoParaPonerseAlDia,
  calcularInteresesPendientes,
  calcularPorcentajePagado,
  calcularLiquidacionAnticipada,
  calcularInteresMoratorio,
  tieneTablaAmortizacion,
} from './calculos'

// ─────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────

function fecha(str) { return new Date(str + 'T05:00:00.000Z') }

function crearPrestamo(overrides = {}) {
  const base = {
    estado: 'activo',
    montoPrestado: 1000000,
    tasaInteres: 10,
    totalAPagar: 1100000,
    cuotaDiaria: 36700,
    frecuencia: 'diario',
    modoInteres: 'fijo',
    fechaInicio: fecha('2026-01-01'),
    diasPlazo: 30,
    pagos: [],
    cuotasAmortizacion: undefined,
    ...overrides,
  }
  if (base.pagos.length) {
    base.totalPagado = base.pagos.reduce((s, p) => s + (p.montoPagado || 0), 0)
  } else {
    base.totalPagado = 0
  }
  return base
}

function crearPago(monto, tipo = 'completo', fechaPago = '2026-01-15') {
  return { montoPagado: monto, tipo, fechaPago: fecha(fechaPago) }
}

function generarPrestamo(params) {
  const resultado = calcularPrestamo(params)
  return crearPrestamo({
    montoPrestado: params.montoPrestado,
    tasaInteres: params.tasaInteres,
    totalAPagar: resultado.totalAPagar,
    cuotaDiaria: resultado.cuotaDiaria,
    frecuencia: params.frecuencia || 'diario',
    modoInteres: resultado.modoInteres,
    fechaInicio: fecha(params.fechaInicio || '2026-01-01'),
    diasPlazo: params.diasPlazo,
    cuotasAmortizacion: resultado.tablaAmortizacion,
    capitalExtra: resultado.capitalExtra,
  })
}

// ─────────────────────────────────────────────────────────────────────
// 1. calcularPrestamo — Generacion de tablas por modo
// ─────────────────────────────────────────────────────────────────────
describe('calcularPrestamo', () => {

  describe('modo fijo', () => {
    it('calcula interes proporcional al plazo (con redondeo de cuota)', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, diasPlazo: 30,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'diario', modoInteres: 'fijo',
      })
      expect(r.modoInteres).toBe('fijo')
      // interes base = 100000, pero cuota redondeada sube el total
      expect(r.totalInteres).toBeGreaterThanOrEqual(100000)
      expect(r.totalAPagar).toBe(r.cuotaDiaria * r.numPeriodos)
      expect(r.numPeriodos).toBe(30)
    })

    it('2 meses duplica el interes', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, diasPlazo: 60,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'diario', modoInteres: 'fijo',
      })
      expect(r.totalInteres).toBe(200000)
    })

    it('frecuencia mensual — 3 meses', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 5, diasPlazo: 90,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'fijo',
      })
      expect(r.numPeriodos).toBe(3)
      // interes base = 150000, cuota redondeada puede subirlo
      expect(r.totalInteres).toBeGreaterThanOrEqual(150000)
      expect(r.totalAPagar).toBe(r.cuotaDiaria * 3)
    })

    it('cuota se redondea al multiplo de 100 hacia arriba', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, diasPlazo: 30,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'diario', modoInteres: 'fijo',
      })
      expect(r.cuotaDiaria % 100).toBe(0)
      expect(r.cuotaDiaria).toBeGreaterThanOrEqual(Math.ceil(1100000 / 30))
    })
  })

  describe('modo unico', () => {
    it('interes base es igual sin importar plazo (redondeo de cuota puede variar)', () => {
      const r30 = calcularPrestamo({
        montoPrestado: 500000, tasaInteres: 20, diasPlazo: 30,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'unico',
      })
      const r90 = calcularPrestamo({
        montoPrestado: 500000, tasaInteres: 20, diasPlazo: 90,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'unico',
      })
      // Con frecuencia mensual, 1 periodo y 3 periodos: cuota base = total/periodos
      // El interes base es 100000 en ambos; el redondeo de cuota puede diferir
      expect(r30.totalInteres).toBeGreaterThanOrEqual(100000)
      expect(r90.totalInteres).toBeGreaterThanOrEqual(100000)
      // La diferencia entre ambos debe ser minima (solo por redondeo)
      expect(Math.abs(r30.totalInteres - r90.totalInteres)).toBeLessThan(5000)
    })
  })

  describe('modo saldo (frances)', () => {
    it('genera tabla con saldo final 0', () => {
      const r = calcularPrestamo({
        montoPrestado: 4000000, tasaInteres: 3, diasPlazo: 450,
        fechaInicio: fecha('2026-01-30'), frecuencia: 'mensual', modoInteres: 'saldo',
      })
      expect(r.modoInteres).toBe('saldo')
      expect(r.tablaAmortizacion).toBeDefined()
      const ultima = r.tablaAmortizacion[r.tablaAmortizacion.length - 1]
      expect(ultima.saldoRestante).toBe(0)
    })

    it('interes decrece periodo a periodo', () => {
      const r = calcularPrestamo({
        montoPrestado: 2000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'saldo',
      })
      const t = r.tablaAmortizacion
      for (let i = 1; i < t.length - 1; i++) {
        expect(t[i].interes).toBeLessThanOrEqual(t[i - 1].interes)
      }
    })

    it('suma de capital en tabla = monto prestado', () => {
      const r = calcularPrestamo({
        montoPrestado: 3000000, tasaInteres: 5, diasPlazo: 360,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'saldo',
      })
      const sumaCapital = r.tablaAmortizacion.reduce((s, f) => s + f.capital, 0)
      expect(sumaCapital).toBeCloseTo(3000000, -2)
    })

    it('con capitalExtra genera cuotas mas altas en periodos extra', () => {
      const r = calcularPrestamo({
        montoPrestado: 4000000, tasaInteres: 3, diasPlazo: 450,
        fechaInicio: fecha('2026-01-30'), frecuencia: 'mensual', modoInteres: 'saldo',
        capitalExtra: [{ numeroPeriodo: 6, monto: 250000 }, { numeroPeriodo: 11, monto: 250000 }],
      })
      const p6 = r.tablaAmortizacion.find(f => f.numeroPeriodo === 6)
      const p5 = r.tablaAmortizacion.find(f => f.numeroPeriodo === 5)
      expect(p6.cuotaTotal).toBeGreaterThan(p5.cuotaTotal)
    })

    it('con cuotaManual respeta la cuota fijada', () => {
      const r = calcularPrestamo({
        montoPrestado: 4000000, tasaInteres: 3, diasPlazo: 450,
        fechaInicio: fecha('2026-01-30'), frecuencia: 'mensual', modoInteres: 'saldo',
        cuotaManual: 300000,
      })
      expect(r.cuotaDiaria).toBe(300000)
      const sinExtra = r.tablaAmortizacion.filter(f => !f.esExtra)
      sinExtra.forEach(f => {
        if (f.numeroPeriodo < r.numPeriodos) expect(f.cuotaTotal).toBe(300000)
      })
    })
  })

  describe('modo lineal', () => {
    it('capital fijo por periodo + interes decreciente', () => {
      const r = calcularPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'lineal',
      })
      expect(r.modoInteres).toBe('lineal')
      const t = r.tablaAmortizacion
      const capBase = Math.round(1200000 / 6)
      t.forEach(f => {
        if (f.numeroPeriodo < 6) expect(f.capital).toBe(capBase)
      })
      expect(t[0].interes).toBeGreaterThan(t[t.length - 1].interes)
    })

    it('cuotaTotal es decreciente', () => {
      const r = calcularPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'lineal',
      })
      const t = r.tablaAmortizacion
      for (let i = 1; i < t.length; i++) {
        expect(t[i].cuotaTotal).toBeLessThanOrEqual(t[i - 1].cuotaTotal)
      }
    })
  })

  describe('modo solo_interes (globo)', () => {
    it('capital 0 hasta la ultima cuota', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'solo_interes',
      })
      const t = r.tablaAmortizacion
      t.slice(0, -1).forEach(f => expect(f.capital).toBe(0))
      expect(t[t.length - 1].capital).toBe(1000000)
    })

    it('interes constante cada periodo (sin extras)', () => {
      const r = calcularPrestamo({
        montoPrestado: 1000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: 'solo_interes',
      })
      const t = r.tablaAmortizacion
      const interesFijo = Math.round(1000000 * 0.03)
      t.slice(0, -1).forEach(f => expect(f.interes).toBe(interesFijo))
    })
  })

  describe('modo manual', () => {
    it('la cuota la fija el usuario', () => {
      const r = calcularPrestamo({
        montoPrestado: 500000, tasaInteres: 10, diasPlazo: 30,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'diario',
        modoInteres: 'fijo', cuotaManual: 25000,
      })
      expect(r.modoInteres).toBe('manual')
      expect(r.cuotaDiaria).toBe(25000)
      expect(r.totalAPagar).toBe(25000 * 30)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// 2. Saldo pendiente y capital restante
// ─────────────────────────────────────────────────────────────────────
describe('saldoPendiente y capitalRestante', () => {

  it('sin pagos, saldo = totalAPagar', () => {
    const p = crearPrestamo()
    expect(calcularSaldoPendiente(p)).toBe(1100000)
  })

  it('saldo baja con cada pago', () => {
    const p = crearPrestamo({ pagos: [crearPago(300000)], totalPagado: 300000 })
    expect(calcularSaldoPendiente(p)).toBe(800000)
  })

  it('saldo nunca es negativo', () => {
    const p = crearPrestamo({ pagos: [crearPago(5000000)], totalPagado: 5000000 })
    expect(calcularSaldoPendiente(p)).toBe(0)
  })

  describe('capitalRestante con tabla (modo saldo)', () => {
    it('sin pagos = monto prestado', () => {
      const p = generarPrestamo({
        montoPrestado: 2000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'saldo',
      })
      expect(calcularCapitalRestante(p)).toBe(2000000)
    })

    it('despues de N pagos completos, capital baja segun tabla', () => {
      const p = generarPrestamo({
        montoPrestado: 2000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'saldo',
      })
      const cuota1 = p.cuotasAmortizacion[0].cuotaTotal
      p.pagos = [crearPago(cuota1)]
      p.totalPagado = cuota1
      const capitalEsperado = p.cuotasAmortizacion[0].saldoRestante
      expect(calcularCapitalRestante(p)).toBeCloseTo(capitalEsperado, -1)
    })

    it('pago parcial en cuota futura descuenta capital correctamente', () => {
      const p = generarPrestamo({
        montoPrestado: 4000000, tasaInteres: 3, diasPlazo: 450,
        fechaInicio: '2026-01-30', frecuencia: 'mensual', modoInteres: 'saldo',
        capitalExtra: [{ numeroPeriodo: 6, monto: 250000 }, { numeroPeriodo: 11, monto: 250000 }],
      })
      // Simular 4×300K + 1×550K (caso Tinoco)
      const cuotaReg = p.cuotaDiaria
      const totalPagado = cuotaReg * 4 + 550000
      p.pagos = [
        crearPago(cuotaReg), crearPago(cuotaReg),
        crearPago(cuotaReg), crearPago(cuotaReg),
        crearPago(550000),
      ]
      p.totalPagado = totalPagado

      const cr = calcularCapitalRestante(p)
      // NO debe ser el saldo del periodo 5 de la tabla (ignora el pago parcial al 6)
      const saldoPeriodo5 = p.cuotasAmortizacion[4].saldoRestante
      expect(cr).toBeLessThan(saldoPeriodo5)
    })
  })

  describe('capitalRestante sin tabla (modo fijo)', () => {
    it('pago cubre interes primero, luego capital', () => {
      const p = crearPrestamo({
        montoPrestado: 1000000, totalAPagar: 1200000,
        pagos: [crearPago(1200000)], totalPagado: 1200000,
      })
      expect(calcularCapitalRestante(p)).toBe(0)
    })

    it('pago parcial solo cubre interes', () => {
      const p = crearPrestamo({
        montoPrestado: 1000000, totalAPagar: 1200000,
        pagos: [crearPago(100000)], totalPagado: 100000,
      })
      // Interes total = 200K. Pago 100K < interes, capital no se toca
      expect(calcularCapitalRestante(p)).toBe(1000000)
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// 3. Mora — diasMora, cuotasEnMora, montoEnMora
// ─────────────────────────────────────────────────────────────────────
describe('mora', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sin mora si esta al dia', () => {
    vi.setSystemTime(fecha('2026-01-10'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'),
      cuotaDiaria: 36700, totalAPagar: 1100000,
      pagos: Array.from({ length: 10 }, () => crearPago(36700)),
      totalPagado: 367000,
    })
    expect(calcularDiasMora(p)).toBe(0)
  })

  it('1 dia de gracia — dia de cobro no cuenta', () => {
    vi.setSystemTime(fecha('2026-01-02'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'),
      frecuencia: 'diario', cuotaDiaria: 36700, totalAPagar: 1100000,
    })
    // Dia 2, debio pagar dia 1 — pero tiene 1 dia de gracia
    expect(calcularDiasMora(p)).toBe(0)
  })

  it('mora empieza despues de la gracia', () => {
    vi.setSystemTime(fecha('2026-01-04'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'),
      frecuencia: 'diario', cuotaDiaria: 36700, totalAPagar: 1100000,
    })
    expect(calcularDiasMora(p)).toBeGreaterThan(0)
  })

  it('prestamo cancelado no tiene mora', () => {
    vi.setSystemTime(fecha('2026-02-15'))
    const p = crearPrestamo({ estado: 'cancelado' })
    expect(calcularDiasMora(p)).toBe(0)
  })

  describe('mora con tabla de amortizacion', () => {
    it('cuota vencida no pagada genera mora', () => {
      vi.setSystemTime(fecha('2026-03-05'))
      const p = generarPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'lineal',
      })
      // No pago nada, la cuota 1 vencio 2026-01-31, cuota 2 vencio 2026-03-02
      expect(calcularDiasMora(p)).toBeGreaterThan(0)
    })

    it('cuotas pagadas no generan mora', () => {
      vi.setSystemTime(fecha('2026-03-05'))
      const p = generarPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'lineal',
      })
      const cuota1 = p.cuotasAmortizacion[0].cuotaTotal
      const cuota2 = p.cuotasAmortizacion[1].cuotaTotal
      p.cuotasAmortizacion[0].pagado = cuota1
      p.cuotasAmortizacion[1].pagado = cuota2
      p.pagos = [crearPago(cuota1, 'completo', '2026-01-31'), crearPago(cuota2, 'completo', '2026-03-02')]
      p.totalPagado = cuota1 + cuota2
      expect(calcularDiasMora(p)).toBe(0)
    })
  })

  it('montoEnMora no excede saldo pendiente', () => {
    vi.setSystemTime(fecha('2026-06-01'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'), frecuencia: 'diario',
      cuotaDiaria: 36700, totalAPagar: 1100000,
    })
    const mora = calcularMontoEnMora(p)
    const saldo = calcularSaldoPendiente(p)
    expect(mora).toBeLessThanOrEqual(saldo)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 4. Cuotas pendientes
// ─────────────────────────────────────────────────────────────────────
describe('cuotasPendientes', () => {
  it('sin pagos = todas las cuotas', () => {
    const p = crearPrestamo({ cuotaDiaria: 36700, totalAPagar: 1100000 })
    expect(calcularCuotasPendientes(p)).toBe(30)
  })

  it('con pagos reduce cuotas pendientes', () => {
    const p = crearPrestamo({
      cuotaDiaria: 36700, totalAPagar: 1100000,
      pagos: [crearPago(367000)], totalPagado: 367000,
    })
    expect(calcularCuotasPendientes(p)).toBe(20)
  })

  it('con tabla: cuenta cuotas no pagadas completamente', () => {
    const p = generarPrestamo({
      montoPrestado: 600000, tasaInteres: 5, diasPlazo: 180,
      fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'lineal',
    })
    expect(calcularCuotasPendientes(p)).toBe(6)
    p.cuotasAmortizacion[0].pagado = p.cuotasAmortizacion[0].cuotaTotal
    expect(calcularCuotasPendientes(p)).toBe(5)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 5. Porcentaje pagado
// ─────────────────────────────────────────────────────────────────────
describe('porcentajePagado', () => {
  it('0% sin pagos', () => {
    const p = crearPrestamo()
    expect(calcularPorcentajePagado(p)).toBe(0)
  })

  it('50% con mitad pagada', () => {
    const p = crearPrestamo({ pagos: [crearPago(550000)], totalPagado: 550000 })
    expect(calcularPorcentajePagado(p)).toBe(50)
  })

  it('100% max', () => {
    const p = crearPrestamo({ pagos: [crearPago(9999999)], totalPagado: 9999999 })
    expect(calcularPorcentajePagado(p)).toBe(100)
  })
})

// ─────────────────────────────────────────────────────────────────────
// 6. Liquidacion anticipada — EL TEST MAS CRITICO
// ─────────────────────────────────────────────────────────────────────
describe('calcularLiquidacionAnticipada', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  describe('modo fijo (sin tabla)', () => {
    it('sin pagos: restanteHoy = capital + interes devengado', () => {
      vi.setSystemTime(fecha('2026-01-16'))
      const p = crearPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, totalAPagar: 1100000,
        cuotaDiaria: 36700, frecuencia: 'diario', modoInteres: 'fijo',
        fechaInicio: fecha('2026-01-01'), diasPlazo: 30,
      })
      const liq = calcularLiquidacionAnticipada(p)
      expect(liq.capital).toBe(1000000)
      expect(liq.totalPagadoReal).toBe(0)
      // mesCompleto cobra el mes entero: restanteHoy = capital + interes completo
      expect(liq.mesCompleto.restanteHoy).toBeGreaterThanOrEqual(1000000)
      expect(liq.mesCompleto.restanteHoy).toBeLessThanOrEqual(1100000)
      // proporcional cobra fraccion: debe ser menor
      expect(liq.proporcional.restanteHoy).toBeLessThanOrEqual(liq.mesCompleto.restanteHoy)
    })

    it('con pagos: restanteHoy se reduce', () => {
      vi.setSystemTime(fecha('2026-01-16'))
      const p = crearPrestamo({
        montoPrestado: 1000000, tasaInteres: 10, totalAPagar: 1100000,
        cuotaDiaria: 36700, frecuencia: 'diario', modoInteres: 'fijo',
        fechaInicio: fecha('2026-01-01'), diasPlazo: 30,
        pagos: [crearPago(500000)], totalPagado: 500000,
      })
      const liq = calcularLiquidacionAnticipada(p)
      expect(liq.mesCompleto.restanteHoy).toBeLessThanOrEqual(600000)
    })
  })

  describe('modo saldo (con tabla)', () => {
    function crearCasoSaldo() {
      const p = generarPrestamo({
        montoPrestado: 4000000, tasaInteres: 3, diasPlazo: 450,
        fechaInicio: '2026-01-30', frecuencia: 'mensual', modoInteres: 'saldo',
        capitalExtra: [{ numeroPeriodo: 6, monto: 250000 }, { numeroPeriodo: 11, monto: 250000 }],
      })
      return p
    }

    it('sin pagos: capitalRestante = monto original', () => {
      vi.setSystemTime(fecha('2026-02-15'))
      const p = crearCasoSaldo()
      const liq = calcularLiquidacionAnticipada(p)
      expect(liq.capitalRestante).toBe(4000000)
    })

    it('despues de 5 pagos on-time: capitalRestante correcto', () => {
      vi.setSystemTime(fecha('2026-07-18'))
      const p = crearCasoSaldo()
      const cuota = p.cuotaDiaria
      p.pagos = Array.from({ length: 5 }, (_, i) =>
        crearPago(cuota, 'completo', `2026-0${3 + i}-01`)
      )
      p.totalPagado = cuota * 5

      const liq = calcularLiquidacionAnticipada(p)
      const crSeparado = calcularCapitalRestante(p)
      expect(liq.capitalRestante).toBe(crSeparado)
    })

    it('BUG TINOCO: pago adelantado se refleja en capitalRestante', () => {
      vi.setSystemTime(fecha('2026-07-18'))
      const p = crearCasoSaldo()
      const cuota = p.cuotaDiaria // 300000
      // 4 regulares + 1 extra de 550K
      p.pagos = [
        crearPago(cuota, 'completo', '2026-03-01'),
        crearPago(cuota, 'completo', '2026-03-31'),
        crearPago(cuota, 'completo', '2026-04-30'),
        crearPago(cuota, 'completo', '2026-05-30'),
        crearPago(550000, 'completo', '2026-07-18'),
      ]
      p.totalPagado = cuota * 4 + 550000

      const liq = calcularLiquidacionAnticipada(p)
      const crSeparado = calcularCapitalRestante(p)

      // capitalRestante de liquidacion DEBE coincidir con calcularCapitalRestante
      expect(liq.capitalRestante).toBe(crSeparado)

      // NO debe ser el saldo de periodo 5 (el bug anterior)
      const saldoPeriodo5 = p.cuotasAmortizacion[4].saldoRestante
      expect(liq.capitalRestante).toBeLessThan(saldoPeriodo5)
    })

    it('restanteHoy = capital + interes devengado - pagado (sin doble sustraccion)', () => {
      vi.setSystemTime(fecha('2026-07-18'))
      const p = crearCasoSaldo()
      const cuota = p.cuotaDiaria
      p.pagos = Array.from({ length: 5 }, (_, i) =>
        crearPago(cuota, 'completo', `2026-0${3 + i}-01`)
      )
      p.totalPagado = cuota * 5

      const liq = calcularLiquidacionAnticipada(p)

      // restanteHoy debe ser >= capitalRestante (capital + algun interes - pagos)
      expect(liq.mesCompleto.restanteHoy).toBeGreaterThanOrEqual(liq.capitalRestante)
    })

    it('interesPerdonado = interes futuro no devengado', () => {
      vi.setSystemTime(fecha('2026-07-18'))
      const p = crearCasoSaldo()
      const cuota = p.cuotaDiaria
      p.pagos = Array.from({ length: 5 }, (_, i) =>
        crearPago(cuota, 'completo', `2026-0${3 + i}-01`)
      )
      p.totalPagado = cuota * 5

      const liq = calcularLiquidacionAnticipada(p)
      expect(liq.mesCompleto.interesPerdonado).toBeGreaterThan(0)
      expect(liq.mesCompleto.interesPerdonado).toBeLessThan(liq.interesTotalPactado)
    })
  })

  describe('modo lineal (con tabla)', () => {
    it('capitalRestante coincide con calcularCapitalRestante', () => {
      vi.setSystemTime(fecha('2026-04-01'))
      const p = generarPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'lineal',
      })
      const cuota1 = p.cuotasAmortizacion[0].cuotaTotal
      const cuota2 = p.cuotasAmortizacion[1].cuotaTotal
      p.pagos = [crearPago(cuota1, 'completo', '2026-02-01'), crearPago(cuota2, 'completo', '2026-03-01')]
      p.totalPagado = cuota1 + cuota2
      p.cuotasAmortizacion[0].pagado = cuota1
      p.cuotasAmortizacion[1].pagado = cuota2

      const liq = calcularLiquidacionAnticipada(p)
      const cr = calcularCapitalRestante(p)
      expect(liq.capitalRestante).toBe(cr)
    })
  })

  describe('modo lineal_dinamico (con tabla)', () => {
    it('capitalRestante refleja pagos reales', () => {
      vi.setSystemTime(fecha('2026-04-01'))
      const p = generarPrestamo({
        montoPrestado: 1200000, tasaInteres: 5, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'lineal_dinamico',
      })
      const cuota1 = p.cuotasAmortizacion[0].cuotaTotal
      p.pagos = [crearPago(cuota1, 'completo', '2026-02-01')]
      p.totalPagado = cuota1
      p.cuotasAmortizacion[0].pagado = cuota1

      const liq = calcularLiquidacionAnticipada(p)
      const cr = calcularCapitalRestante(p)
      expect(liq.capitalRestante).toBe(cr)
    })
  })

  describe('modo solo_interes (globo)', () => {
    it('capital restante = monto hasta la ultima cuota', () => {
      vi.setSystemTime(fecha('2026-04-01'))
      const p = generarPrestamo({
        montoPrestado: 1000000, tasaInteres: 3, diasPlazo: 180,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: 'solo_interes',
      })
      // Pagar 3 cuotas de solo interes
      const intCuota = p.cuotasAmortizacion[0].cuotaTotal
      p.pagos = [crearPago(intCuota), crearPago(intCuota), crearPago(intCuota)]
      p.totalPagado = intCuota * 3
      p.cuotasAmortizacion[0].pagado = intCuota
      p.cuotasAmortizacion[1].pagado = intCuota
      p.cuotasAmortizacion[2].pagado = intCuota

      const liq = calcularLiquidacionAnticipada(p)
      // Capital no cambia porque solo se pago interes
      expect(liq.capitalRestante).toBe(1000000)
    })
  })

  describe('modo unico', () => {
    it('interes se devenga completo al prestar', () => {
      vi.setSystemTime(fecha('2026-01-16'))
      const p = crearPrestamo({
        montoPrestado: 500000, tasaInteres: 20, totalAPagar: 600000,
        cuotaDiaria: 20000, frecuencia: 'diario', modoInteres: 'unico',
        fechaInicio: fecha('2026-01-01'), diasPlazo: 30,
      })
      const liq = calcularLiquidacionAnticipada(p)
      // En modo unico, el interes es el total siempre
      expect(liq.mesCompleto.interesDevengado).toBe(100000)
    })
  })

  describe('propiedades invariantes (todos los modos con tabla)', () => {
    const modos = [
      { modoInteres: 'saldo', tasaInteres: 3 },
      { modoInteres: 'lineal', tasaInteres: 5 },
      { modoInteres: 'solo_interes', tasaInteres: 3 },
    ]

    modos.forEach(({ modoInteres, tasaInteres }) => {
      it(`${modoInteres}: restanteHoy >= 0`, () => {
        vi.setSystemTime(fecha('2026-04-01'))
        const p = generarPrestamo({
          montoPrestado: 2000000, tasaInteres, diasPlazo: 360,
          fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres,
        })
        const cuota1 = p.cuotasAmortizacion[0].cuotaTotal
        p.pagos = [crearPago(cuota1)]
        p.totalPagado = cuota1
        p.cuotasAmortizacion[0].pagado = cuota1

        const liq = calcularLiquidacionAnticipada(p)
        expect(liq.mesCompleto.restanteHoy).toBeGreaterThanOrEqual(0)
        expect(liq.proporcional.restanteHoy).toBeGreaterThanOrEqual(0)
      })

      it(`${modoInteres}: totalCierre >= capitalRestante`, () => {
        vi.setSystemTime(fecha('2026-04-01'))
        const p = generarPrestamo({
          montoPrestado: 2000000, tasaInteres, diasPlazo: 360,
          fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres,
        })
        const liq = calcularLiquidacionAnticipada(p)
        expect(liq.mesCompleto.totalCierre).toBeGreaterThanOrEqual(liq.capitalRestante)
      })

      it(`${modoInteres}: interesPerdonado >= 0`, () => {
        vi.setSystemTime(fecha('2026-04-01'))
        const p = generarPrestamo({
          montoPrestado: 2000000, tasaInteres, diasPlazo: 360,
          fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres,
        })
        const liq = calcularLiquidacionAnticipada(p)
        expect(liq.mesCompleto.interesPerdonado).toBeGreaterThanOrEqual(0)
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────
// 7. Interes moratorio
// ─────────────────────────────────────────────────────────────────────
describe('interesMoratorio', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('sin tasa moratorio: no aplica', () => {
    vi.setSystemTime(fecha('2026-03-01'))
    const p = crearPrestamo({ fechaInicio: fecha('2026-01-01') })
    const r = calcularInteresMoratorio(p, [], [], 0)
    expect(r.aplicable).toBe(false)
  })

  it('con gracia: no aplica si mora < gracia', () => {
    vi.setSystemTime(fecha('2026-01-06'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'), frecuencia: 'diario',
      cuotaDiaria: 36700, totalAPagar: 1100000,
    })
    const r = calcularInteresMoratorio(p, [], [], 5, 5)
    expect(r.aplicable).toBe(false)
  })

  it('moratorio con tope al 50% del saldo', () => {
    vi.setSystemTime(fecha('2026-06-01'))
    const p = crearPrestamo({
      fechaInicio: fecha('2026-01-01'), frecuencia: 'diario',
      cuotaDiaria: 36700, totalAPagar: 1100000,
    })
    const saldo = calcularSaldoPendiente(p)
    const r = calcularInteresMoratorio(p, [], [], 10, 0)
    if (r.aplicable) {
      expect(r.montoMoratorio).toBeLessThanOrEqual(Math.round(saldo * 0.5))
    }
  })
})

// ─────────────────────────────────────────────────────────────────────
// 8. Invariantes de integridad — cruzan multiples funciones
// ─────────────────────────────────────────────────────────────────────
describe('invariantes de integridad', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  const modos = ['fijo', 'saldo', 'lineal', 'solo_interes', 'unico']

  modos.forEach(modo => {
    it(`${modo}: saldoPendiente + totalPagado = totalAPagar`, () => {
      const params = {
        montoPrestado: 1000000, tasaInteres: modo === 'lineal' ? 5 : 10,
        diasPlazo: 180, fechaInicio: '2026-01-01', frecuencia: 'mensual',
        modoInteres: modo,
      }
      const r = calcularPrestamo(params)
      const p = crearPrestamo({
        montoPrestado: 1000000, tasaInteres: params.tasaInteres,
        totalAPagar: r.totalAPagar, cuotaDiaria: r.cuotaDiaria,
        frecuencia: 'mensual', modoInteres: r.modoInteres,
        fechaInicio: fecha('2026-01-01'), diasPlazo: 180,
        cuotasAmortizacion: r.tablaAmortizacion,
        pagos: [crearPago(300000)], totalPagado: 300000,
      })
      const saldo = calcularSaldoPendiente(p)
      expect(saldo + 300000).toBe(r.totalAPagar)
    })
  })

  it('capitalRestante <= montoPrestado siempre', () => {
    const modosTbl = ['saldo', 'lineal', 'solo_interes']
    modosTbl.forEach(modo => {
      const p = generarPrestamo({
        montoPrestado: 2000000, tasaInteres: 5, diasPlazo: 360,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: modo,
      })
      expect(calcularCapitalRestante(p)).toBeLessThanOrEqual(2000000)
    })
  })

  it('saldo con tabla: sum(capital) = montoPrestado', () => {
    const modosTbl = ['saldo', 'lineal', 'lineal_dinamico', 'solo_interes']
    modosTbl.forEach(modo => {
      const r = calcularPrestamo({
        montoPrestado: 3000000, tasaInteres: 5, diasPlazo: 360,
        fechaInicio: fecha('2026-01-01'), frecuencia: 'mensual', modoInteres: modo,
      })
      if (r.tablaAmortizacion) {
        const sumaCapital = r.tablaAmortizacion.reduce((s, f) => s + f.capital, 0)
        expect(sumaCapital).toBeCloseTo(3000000, -2)
      }
    })
  })

  it('liquidacion capitalRestante == calcularCapitalRestante para todo modo con tabla', () => {
    vi.setSystemTime(fecha('2026-04-01'))
    const modosTbl = ['saldo', 'lineal', 'lineal_dinamico', 'solo_interes']
    modosTbl.forEach(modo => {
      const p = generarPrestamo({
        montoPrestado: 2000000, tasaInteres: 5, diasPlazo: 360,
        fechaInicio: '2026-01-01', frecuencia: 'mensual', modoInteres: modo,
      })
      const c1 = p.cuotasAmortizacion[0].cuotaTotal
      p.pagos = [crearPago(c1)]
      p.totalPagado = c1
      p.cuotasAmortizacion[0].pagado = c1

      const liq = calcularLiquidacionAnticipada(p)
      const cr = calcularCapitalRestante(p)
      expect(liq.capitalRestante).toBe(cr)
    })
  })
})
