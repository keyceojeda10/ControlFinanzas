/* El interés moratorio se ofrece por lo que FALTA de esta racha de mora, no
   por el acumulado. Medido en el espejo el 8 sep 2026: tres pulsaciones del
   mismo lote de $855 cobraron $2.968, porque la pantalla volvía a listar a los
   mismos préstamos con la misma cifra nada más aplicarles. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  calcularInteresMoratorio, calcularDiasMora, fechaInicioMora, moratorioYaAplicado,
} from '@/lib/calculos'

const fecha = (s) => new Date(`${s}T05:00:00.000Z`)
afterEach(() => vi.useRealTimers())

function diario(extra = {}) {
  return {
    estado: 'activo', frecuencia: 'diario', modoInteres: 'fijo',
    montoPrestado: 1000000, totalAPagar: 1100000, cuotaDiaria: 36700,
    fechaInicio: fecha('2026-08-01'), pagos: [], ...extra,
  }
}

describe('lo ya aplicado en esta racha se descuenta', () => {
  it('sin nada aplicado, ofrece el cálculo entero', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    const r = calcularInteresMoratorio(diario(), [], [], 10, 0)
    expect(r.aplicable).toBe(true)
    expect(r.yaAplicado).toBe(0)
  })
  it('con un moratorio aplicado ayer, hoy ofrece solo la diferencia', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    const entero = calcularInteresMoratorio(diario(), [], [], 10, 0).montoMoratorio
    const ayer = { tipo: 'recargo', nota: 'Interés moratorio · 3 días sobre $110.100 en mora', montoPagado: 500, fechaPago: fecha('2026-08-19') }
    const r = calcularInteresMoratorio(diario({ pagos: [ayer] }), [], [], 10, 0)
    expect(r.yaAplicado).toBe(500)
    expect(r.montoMoratorio).toBe(entero - 500)
  })
  it('si ya se aplicó todo, no ofrece nada (y el lote lo deja fuera)', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    const entero = calcularInteresMoratorio(diario(), [], [], 10, 0).montoMoratorio
    const hoy = { tipo: 'recargo', nota: 'Interés moratorio: 3 días sobre $110.100', montoPagado: entero, fechaPago: fecha('2026-08-20') }
    const r = calcularInteresMoratorio(diario({ pagos: [hoy] }), [], [], 10, 0)
    expect(r.montoMoratorio).toBe(0)
    expect(r.aplicable).toBe(false)
  })
  it('un moratorio de una mora ANTERIOR no descuenta nada', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    const p = diario()
    const inicio = fechaInicioMora(p, [], [])
    expect(inicio).toBeInstanceOf(Date)
    const viejo = { tipo: 'recargo', nota: 'Interés moratorio · 2 días', montoPagado: 900, fechaPago: new Date(inicio.getTime() - 86400000) }
    expect(moratorioYaAplicado([viejo], inicio)).toBe(0)
    expect(calcularInteresMoratorio(diario({ pagos: [viejo] }), [], [], 10, 0).yaAplicado).toBe(0)
  })
  it('un recargo que no es moratorio (ni un descuento) no cuenta', () => {
    const desde = fecha('2026-08-01')
    expect(moratorioYaAplicado([
      { tipo: 'recargo', nota: 'Recargo por cobro en moto', montoPagado: 5000, fechaPago: fecha('2026-08-10') },
      { tipo: 'descuento', nota: 'Interés moratorio perdonado', montoPagado: 300, fechaPago: fecha('2026-08-10') },
      { tipo: 'recargo', nota: 'interes moratorio sin tilde', montoPagado: 40, fechaPago: fecha('2026-08-10') },
    ], desde)).toBe(40)
  })
})

describe('fechaInicioMora es la misma ancla con la que se cuentan los días', () => {
  it('lineal diario sin días excluidos: los días de mora son los que van del ancla a hoy', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    const p = diario()
    const ancla = fechaInicioMora(p, [], [])
    const hoy = fecha('2026-08-20') // 05:00Z = medianoche en Bogotá, el mismo instante que fija el reloj
    const dias = calcularDiasMora(p, [], [])
    expect(dias).toBeGreaterThan(0)
    expect(dias).toBe(Math.round((hoy.getTime() - ancla.getTime()) / 86400000))
  })
  it('sin mora, no hay ancla ni días', () => {
    vi.setSystemTime(fecha('2026-08-01'))
    const p = diario()
    expect(fechaInicioMora(p, [], [])).toBeNull()
    expect(calcularDiasMora(p, [], [])).toBe(0)
  })
  it('no activo o saldado: null', () => {
    vi.setSystemTime(fecha('2026-08-20'))
    expect(fechaInicioMora(diario({ estado: 'completado' }), [], [])).toBeNull()
    expect(fechaInicioMora(diario({ pagos: [{ tipo: 'completo', montoPagado: 1100000, fechaPago: fecha('2026-08-02') }] }), [], [])).toBeNull()
  })
})
