/* Un recargo YA APLICADO no es interés futuro: no se perdona al liquidar.
   Lo destapó Préstamos Rincón el 8 sep 2026, al día siguiente de poder aplicar
   el moratorio por primera vez: su pantalla decía «si lo cancela hoy $208.000,
   se ahorra $708 de interés» sobre un préstamo de UNA cuota ya vencida, cuyo
   único «interés futuro» era el recargo que él acababa de aplicar. Medido en
   producción: 210 préstamos activos con recargos, 20 negocios, 35,3 millones.

   Las pruebas van sobre la INVARIANTE —la diferencia entre el mismo préstamo con
   y sin el ajuste— y no sobre cifras absolutas: así no dependen de cómo se
   reparta el interés en la tabla, que es otro asunto. */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { calcularLiquidacionAnticipada, calcularSaldoPendiente, ajustesYaAplicados } from '@/lib/calculos'

const f = (s) => new Date(`${s}T05:00:00.000Z`)
afterEach(() => vi.useRealTimers())

const conTabla = (extraPagos = [], extraTotal = 0) => ({
  estado: 'activo', frecuencia: 'mensual', modoInteres: 'fijo',
  montoPrestado: 200000, totalAPagar: 624000 + extraTotal,
  cuotaDiaria: 208000, diasPlazo: 90, fechaInicio: f('2026-07-05'), totalPagado: 0,
  pagos: [...extraPagos],
  cuotasAmortizacion: [
    { numeroPeriodo: 1, fechaEsperada: f('2026-08-05'), cuotaTotal: 208000, interes: 8000, capital: 200000 },
    { numeroPeriodo: 2, fechaEsperada: f('2026-09-05'), cuotaTotal: 208000, interes: 8000, capital: 200000 },
    { numeroPeriodo: 3, fechaEsperada: f('2026-10-05'), cuotaTotal: 208000, interes: 8000, capital: 200000 },
  ],
})
const sinTabla = (extraPagos = [], extraTotal = 0) => ({
  estado: 'activo', frecuencia: 'diario', modoInteres: 'fijo',
  montoPrestado: 500000, totalAPagar: 600000 + extraTotal, cuotaDiaria: 20000,
  diasPlazo: 30, fechaInicio: f('2026-09-01'), totalPagado: 0, pagos: [...extraPagos],
})
const RECARGO = (n) => [{ tipo: 'recargo', montoPagado: n, fechaPago: f('2026-09-08'), nota: 'Interés moratorio' }]
const DESCUENTO = (n) => [{ tipo: 'descuento', montoPagado: n, fechaPago: f('2026-09-08'), nota: 'rebaja' }]

describe('la suma de ajustes', () => {
  it('recargos suman, descuentos restan, los pagos normales no cuentan', () => {
    expect(ajustesYaAplicados({ pagos: [...RECARGO(708), ...DESCUENTO(200),
      { tipo: 'completo', montoPagado: 50000 }] })).toBe(508)
    expect(ajustesYaAplicados({ pagos: [] })).toBe(0)
    expect(ajustesYaAplicados({})).toBe(0)
  })
})

for (const [nombre, arma] of [['con tabla de amortización', conTabla], ['sin tabla', sinTabla]]) {
  describe(`liquidar hoy, ${nombre}`, () => {
    it('un recargo aplicado se cobra entero: no cambia lo perdonado y sube lo que hay que pagar', () => {
      vi.setSystemTime(f('2026-09-08'))
      const limpio = calcularLiquidacionAnticipada(arma())
      const conRecargo = calcularLiquidacionAnticipada(arma(RECARGO(2000), 2000))
      for (const m of ['mesCompleto', 'proporcional']) {
        expect(conRecargo[m].interesPerdonado, m).toBe(limpio[m].interesPerdonado)
        expect(conRecargo[m].restanteHoy, m).toBe(limpio[m].restanteHoy + 2000)
      }
    })

    it('un descuento aplicado baja lo que hay que pagar, sin tocar lo perdonado', () => {
      vi.setSystemTime(f('2026-09-08'))
      const limpio = calcularLiquidacionAnticipada(arma())
      const conDesc = calcularLiquidacionAnticipada(arma(DESCUENTO(3000), -3000))
      for (const m of ['mesCompleto', 'proporcional']) {
        expect(conDesc[m].interesPerdonado, m).toBe(limpio[m].interesPerdonado)
        expect(conDesc[m].restanteHoy, m).toBe(limpio[m].restanteHoy - 3000)
      }
    })

    it('el interés de lo que todavía no ha corrido se sigue perdonando', () => {
      vi.setSystemTime(f('2026-09-08'))
      const r = calcularLiquidacionAnticipada(arma(RECARGO(2000), 2000))
      expect(r.proporcional.interesPerdonado).toBeGreaterThan(0)
    })

    it('lo que hay que pagar hoy nunca pasa del saldo', () => {
      vi.setSystemTime(f('2026-09-08'))
      const p = arma(RECARGO(2000), 2000)
      const r = calcularLiquidacionAnticipada(p)
      expect(r.mesCompleto.restanteHoy).toBeLessThanOrEqual(calcularSaldoPendiente(p))
      expect(r.proporcional.restanteHoy).toBeLessThanOrEqual(calcularSaldoPendiente(p))
    })
  })
}
