/* Crediya (Yainer), 20 oct 2026: José Bernal, Globo de $750.000 al 10% mensual.
   Abonó $100.000 a capital y la app pasó a decir que debía $162.845. El capital
   con que se rehacía la cuota grande ya tenía restado el dinero pagado de más,
   y la cuenta acumulada lo volvía a restar. */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { capitalVivoSegunTabla, recalcularTablaSoloInteresDesdeSaldo, regenerarTablaAmortizacion, obtenerProximaCuotaTabla, calcularSaldoPendiente } from '@/lib/calculos'
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

describe('Globo: la próxima cuota dice lo mismo que la deuda', () => {
  // José ya corregido: la cuota grande rehecha y la deuda en $254.200.
  const corregido = () => {
    const p = jose()
    p.totalAPagar = 954200
    p.cuotasAmortizacion[3] = { ...p.cuotasAmortizacion[3], capital: 347250, interes: 34725, cuotaTotal: 381975 }
    return p
  }
  const repartir = (p) => {
    const nuevo = new Map(regenerarTablaAmortizacion(p).map((x) => [x.numeroPeriodo, x.pagado]))
    return { ...p, cuotasAmortizacion: p.cuotasAmortizacion.map((f) => ({ ...f, pagado: nuevo.get(f.numeroPeriodo) })) }
  }

  it('reparte con todo lo pagado menos los abonos que salieron de la tabla', () => {
    const p = repartir(corregido())
    expect(p.cuotasAmortizacion.map((f) => f.pagado)).toEqual([75000, 49750, 44725, 127775])
    expect(calcularSaldoPendiente(p)).toBe(254200)
    // Antes la próxima cuota decía $376.450 con la deuda en $254.200.
    expect(obtenerProximaCuotaTabla(p).faltante).toBe(254200)
  })

  it('el recargo no entra en las cuotas: Diana debe capital $1.000.000 + recargo $200.000', () => {
    const p = repartir({
      modoInteres: 'solo_interes', totalAPagar: 1400000,
      cuotasAmortizacion: [{ numeroPeriodo: 1, capital: 1000000, interes: 200000, cuotaTotal: 1200000, pagado: 0, interesPagado: 200000, fechaEsperada: d('2026-09-13') }],
      pagos: [{ tipo: 'intereses', montoPagado: 200000 }, { tipo: 'recargo', montoPagado: 200000 }],
    })
    expect(obtenerProximaCuotaTabla(p).faltante).toBe(1000000)
    expect(calcularSaldoPendiente(p)).toBe(1200000)
  })

  it('los demás modos reparten como siempre (solo completo/parcial)', () => {
    const lineal = {
      modoInteres: 'lineal', totalAPagar: 120000,
      cuotasAmortizacion: [
        { numeroPeriodo: 1, capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0, interesPagado: 10000 },
        { numeroPeriodo: 2, capital: 50000, interes: 10000, cuotaTotal: 60000, pagado: 0, interesPagado: 0 },
      ],
      pagos: [{ tipo: 'intereses', montoPagado: 10000 }, { tipo: 'completo', montoPagado: 30000 }],
    }
    expect(regenerarTablaAmortizacion(lineal).map((x) => x.pagado)).toEqual([30000, 0])
    // Un Globo sin `totalAPagar` (no se sabe qué abonos salieron): la cuenta de siempre.
    expect(regenerarTablaAmortizacion({ ...lineal, modoInteres: 'solo_interes', totalAPagar: undefined }).map((x) => x.pagado)).toEqual([30000, 0])
  })

  it('el cobro reparte también tras un pago de solo interés, solo en el Globo', () => {
    const r = readFileSync('app/api/prestamos/[id]/pagos/route.js', 'utf8')
    expect(r).toContain("if (tipo !== 'liquidacion' && (tipo !== 'intereses' || prestamoActualizado.modoInteres === 'solo_interes') && tieneTablaAmortizacion(prestamoActualizado)")
  })
})

