/* Crediya (Yainer), 20 oct 2026: José Bernal, Globo de $750.000 al 10% mensual.
   Abonó $100.000 a capital y la app pasó a decir que debía $162.845. El capital
   con que se rehacía la cuota grande ya tenía restado el dinero pagado de más,
   y la cuenta acumulada lo volvía a restar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { capitalVivoSegunTabla, recalcularTablaSoloInteresDesdeSaldo } from '@/lib/calculos'
import { partirFilasParaAbono, capitalParaFuturas, capitalQueSigueEnLaTabla } from '@/lib/dinero/abono-capital'

const d = (s) => new Date(s + 'T05:00:00.000Z')
// Su tabla y sus pagos tal como estaban en la base JUSTO ANTES del abono de hoy.
const filasAntes = () => [
  { numeroPeriodo: 1, capital: 0, interes: 75000, cuotaTotal: 75000, saldoRestante: 750000, pagado: 75000, interesPagado: 0, fechaEsperada: d('2026-08-04') },
  { numeroPeriodo: 2, capital: 0, interes: 49750, cuotaTotal: 49750, saldoRestante: 497500, pagado: 49750, interesPagado: 49750, fechaEsperada: d('2026-09-04') },
  { numeroPeriodo: 3, capital: 0, interes: 44725, cuotaTotal: 44725, saldoRestante: 447250, pagado: 44725, interesPagado: 44725, fechaEsperada: d('2026-10-04') },
  { numeroPeriodo: 4, capital: 447250, interes: 44725, cuotaTotal: 491975, saldoRestante: 0, pagado: 5525, interesPagado: 0, fechaEsperada: d('2026-11-04') },
]
const pagos = [
  ['completo', 75000], ['capital', 25000], ['intereses', 72500], ['capital', 77500], ['capital', 150000],
  ['intereses', 49750], ['capital', 50250], ['completo', 100000], ['capital', 100000], // el de hoy
].map(([tipo, montoPagado], i) => ({ id: `p${i}`, tipo, montoPagado }))
const jose = () => ({
  modoInteres: 'solo_interes', montoPrestado: 750000, tasaInteres: 10, frecuencia: 'mensual',
  fechaInicio: d('2026-07-04'), totalAPagar: 964200, cuotasAmortizacion: filasAntes(), pagos,
})
const HOY = new Date('2026-10-20T22:55:11Z').getTime()

/** Lo que hace el servidor con el abono (bloque 2b de pagos/route.js), con la base que se le dé. */
function abonar(prestamo, monto, capitalBase) {
  const { pagadas, vencidas, futuras } = partirFilasParaAbono(prestamo.cuotasAmortizacion, HOY)
  const saldoCapital = capitalParaFuturas({ capitalAntesDelAbono: capitalBase({ vencidas, futuras }), abono: monto, vencidas })
  const tabla = recalcularTablaSoloInteresDesdeSaldo({
    saldoInicial: saldoCapital, tasaInteres: 10, numPeriodosRestantes: futuras.length,
    primerNumeroPeriodo: futuras[0].numeroPeriodo, fechaBase: pagadas.at(-1).fechaEsperada,
    diasPeriodo: 30, frecuencia: 'mensual',
  })
  const abonos = prestamo.pagos.filter((p) => p.tipo === 'capital').reduce((a, p) => a + p.montoPagado, 0)
  const totalAPagar = [...pagadas, ...vencidas].reduce((a, f) => a + f.cuotaTotal, 0) + abonos + tabla.reduce((a, f) => a + f.cuotaTotal, 0)
  const pagado = prestamo.pagos.reduce((a, p) => a + p.montoPagado, 0)
  return { tabla, totalAPagar, saldo: totalAPagar - pagado }
}

describe('Globo: el abono a capital no resta dos veces el dinero pagado de más', () => {
  it('antes: $162.845, con el capital «vivo» que ya tenía restado lo de más', () => {
    expect(capitalVivoSegunTabla(jose())).toBe(364200)   // 447.250 − 83.050 de más
    expect(abonar(jose(), 100000, () => capitalVivoSegunTabla(jose())).saldo).toBe(162845)
  })

  it('ahora: $254.200 — el capital que sigue en la tabla, y lo de más contado una sola vez', () => {
    const r = abonar(jose(), 100000, capitalQueSigueEnLaTabla)
    expect(r.tabla[0]).toMatchObject({ capital: 347250, interes: 34725, cuotaTotal: 381975 })
    expect(r.totalAPagar).toBe(954200)
    expect(r.saldo).toBe(254200)
    // Al peso: interés de las 4 cuotas = 204.200; de los 297.250 que no fueron
    // abonos, sobran 93.050 que bajan capital; 750.000 − 402.750 − 93.050.
    expect(75000 + 49750 + 44725 + 34725).toBe(204200)
    expect(750000 - 402750 - (297250 - 204200)).toBe(254200)
  })

  it('sin dinero de más sobre las cuotas cerradas, las dos cuentas dan lo mismo', () => {
    // Las cuotas pagadas justas, la grande sin nada encima: lo de siempre.
    const p = jose()
    p.cuotasAmortizacion[3] = { ...p.cuotasAmortizacion[3], pagado: 0 }
    p.pagos = pagos.filter((x) => x.tipo === 'capital')
      .concat([{ id: 'c', tipo: 'completo', montoPagado: 75000 + 49750 + 44725 }])
    const { vencidas, futuras } = partirFilasParaAbono(p.cuotasAmortizacion, HOY)
    expect(capitalQueSigueEnLaTabla({ vencidas, futuras })).toBe(capitalVivoSegunTabla(p))
  })

  it('solo en el Globo; los demás modos siguen con el capital «vivo»', () => {
    const r = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
    expect(r).toContain("const esGlobo = prestamoActualizado.modoInteres === 'solo_interes'")
    expect(r).toMatch(/const capitalAntesDelAbono = esGlobo\s*\? capitalQueSigueEnLaTabla\(\{ vencidas: filasVencidas, futuras: filasFuturas \}\)\s*: capitalVivoSegunTabla\(prestamoActualizado\)/)
    expect(r).not.toContain('conservarInteresEnCurso')
  })
})
