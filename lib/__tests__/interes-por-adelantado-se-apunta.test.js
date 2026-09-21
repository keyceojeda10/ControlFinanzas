/* EL INTERÉS COBRADO POR ADELANTADO SE APUNTA EN SU CUOTA — 21 sep 2026.
 *
 * Inversiones Don Pacho, con una foto: «Adriana está en mora, ayer pagó los
 * intereses atrasados». Su préstamo, al peso (Dinámico, $2.400.000 al 10 %, 6
 * cuotas mensuales desde el 20 jul):
 *
 *   cuota 1 · 20 ago · $640.000 = capital $400.000 + interés $240.000
 *   cuota 2 · 20 sep · $600.000 = capital $400.000 + interés $200.000
 *   cuota 3 · 20 oct · $560.000 = capital $400.000 + interés $160.000
 *
 * El 20 sep pagó $240.000 de interés, y la app le SUGIRIÓ $360.000 más: los
 * $200.000 de la cuota 2 y los $160.000 de la 3 por adelantado. El servidor los
 * aceptó —la validación cuenta la cuota que viene— y el reparto los apuntó
 * saltándose las cuotas futuras: la tabla quedó con $440.000 y los $160.000 de
 * octubre en ninguna parte. El 20 oct la app se los habría vuelto a pedir.
 * En producción ese día: 15 préstamos en 7 negocios, $1.381.933. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'
import {
  interesCobrableAhora, filasDelInteresCobrable, repartoDelPagoDeInteres, deshacerPagoDeInteres,
} from '@/lib/calculos'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')
// Las fechas, a medianoche de Bogotá (05:00 UTC), como las guarda el sistema.
const fecha = (d) => new Date(`${d}T05:00:00.000Z`)
const EL_20_SEP = fecha('2026-09-20')

function adriana(interesPagado = [0, 0, 0, 0, 0, 0]) {
  const filas = [
    ['2026-08-20', 400000, 240000], ['2026-09-20', 400000, 200000], ['2026-10-20', 400000, 160000],
    ['2026-11-20', 400000, 120000], ['2026-12-20', 400000, 80000], ['2027-01-20', 400000, 40000],
  ]
  return {
    modoInteres: 'lineal_dinamico', montoPrestado: 2400000, totalAPagar: 3240000,
    cuotasAmortizacion: filas.map(([f, capital, interes], i) => ({
      numeroPeriodo: i + 1, fechaEsperada: fecha(f), capital, interes,
      cuotaTotal: capital + interes, pagado: 0, interesPagado: interesPagado[i],
    })),
  }
}

// Aplica un reparto a la tabla, como hace el servidor.
function aplicar(p, reparto) {
  const q = structuredClone(p)
  for (const { numeroPeriodo, aplicar: a } of reparto) {
    q.cuotasAmortizacion.find((f) => f.numeroPeriodo === numeroPeriodo).interesPagado += a
  }
  return q
}
const apuntado = (p) => p.cuotasAmortizacion.reduce((a, f) => a + f.interesPagado, 0)

describe('el caso de Adriana, paso a paso', () => {
  it('antes de pagar nada, el 20 sep se le pueden cobrar las cuotas 1 y 2 vencidas y la 3 por adelantado', () => {
    const p = adriana()
    expect(filasDelInteresCobrable(p, EL_20_SEP).map((f) => [f.numeroPeriodo, f.debe, f.vencida])).toEqual([
      [1, 240000, true], [2, 200000, true], [3, 160000, false],
    ])
  })

  it('tras el primer pago de $240.000, la app sugiere $360.000 —que es lo que pagó—', () => {
    const tras1 = aplicar(adriana(), repartoDelPagoDeInteres(adriana(), 240000, EL_20_SEP))
    expect(apuntado(tras1)).toBe(240000)
    const sugerido = filasDelInteresCobrable(tras1, EL_20_SEP).reduce((a, f) => a + f.debe, 0)
    expect(sugerido).toBe(360000)
  })

  it('⚠ y los $360.000 se apuntan ENTEROS: $200.000 en la cuota 2 y $160.000 en la 3', () => {
    const tras1 = aplicar(adriana(), repartoDelPagoDeInteres(adriana(), 240000, EL_20_SEP))
    const reparto = repartoDelPagoDeInteres(tras1, 360000, EL_20_SEP)
    expect(reparto).toEqual([{ numeroPeriodo: 2, aplicar: 200000 }, { numeroPeriodo: 3, aplicar: 160000 }])
    const tras2 = aplicar(tras1, reparto)
    expect(apuntado(tras2), 'lo cobrado y lo apuntado tienen que ser la misma plata').toBe(600000)
    expect(tras2.cuotasAmortizacion[2].interesPagado).toBe(160000)
  })

  it('y el 20 oct la app ya NO le vuelve a pedir el interés de octubre', () => {
    const tras1 = aplicar(adriana(), repartoDelPagoDeInteres(adriana(), 240000, EL_20_SEP))
    const tras2 = aplicar(tras1, repartoDelPagoDeInteres(tras1, 360000, EL_20_SEP))
    const el20oct = fecha('2026-10-20')
    const cuota3 = filasDelInteresCobrable(tras2, el20oct).find((f) => f.numeroPeriodo === 3)
    expect(cuota3, 'la cuota 3 volvía a salir con su interés pendiente').toBeUndefined()
  })
})

describe('las dos vías dicen lo mismo, siempre', () => {
  /* Lo que valida el pago (`interesCobrableAhora`) y lo que lo apunta
     (`repartoDelPagoDeInteres`) salen de la misma lista de filas. Si alguien
     vuelve a escribir una de las dos aparte, esto se pone en rojo. */
  it('todo lo que la validación acepta, el reparto lo apunta', () => {
    const casos = [adriana(), adriana([240000, 0, 0, 0, 0, 0]), adriana([240000, 200000, 0, 0, 0, 0])]
    for (const p of casos) {
      const cobrable = filasDelInteresCobrable(p, EL_20_SEP).reduce((a, f) => a + f.debe, 0)
      const repartido = repartoDelPagoDeInteres(p, cobrable, EL_20_SEP).reduce((a, r) => a + r.aplicar, 0)
      expect(repartido).toBe(cobrable)
    }
  })

  it('interesCobrableAhora es la suma de esas filas', () => {
    const src = leer('lib/calculos.js')
    expect(src).toMatch(/return filasDelInteresCobrable\(prestamo\)\.reduce\(\(a, f\) => a \+ f\.debe, 0\)/)
    expect(typeof interesCobrableAhora).toBe('function')
  })

  it('y el servidor reparte con la función, no con una copia que salte las cuotas futuras', () => {
    const api = leer('app/api/prestamos/[id]/pagos/route.js')
    const i = api.indexOf("if (tipo === 'intereses' && tieneTablaAmortizacion(prestamoActualizado))")
    expect(i).toBeGreaterThan(-1)
    const bloque = api.slice(i, i + 900)
    expect(bloque).toContain('repartoDelPagoDeInteres(prestamoActualizado, montoFinal)')
    expect(bloque, 'volvió el salto de las cuotas que aún no vencen').not.toMatch(/fechaEsperada\) > ahora\) continue/)
  })
})

describe('borrar un pago de interés lo quita de la tabla', () => {
  it('se deshace desde la cuota más nueva, al revés de como entró', () => {
    const p = adriana([240000, 200000, 160000, 0, 0, 0])
    expect(deshacerPagoDeInteres(p, 360000)).toEqual([
      { numeroPeriodo: 3, quitar: 160000 }, { numeroPeriodo: 2, quitar: 200000 },
    ])
  })
  it('y nunca deja una cuota en negativo', () => {
    const p = adriana([100000, 0, 0, 0, 0, 0])
    expect(deshacerPagoDeInteres(p, 500000)).toEqual([{ numeroPeriodo: 1, quitar: 100000 }])
  })
  it('el borrado del pago lo usa', () => {
    const api = leer('app/api/pagos/[id]/route.js')
    expect(api).toContain("if (pago.tipo === 'intereses' && Array.isArray(prestamo.cuotasAmortizacion))")
    expect(api).toContain('deshacerPagoDeInteres(prestamo, pago.montoPagado)')
    expect(api).toMatch(/cuotasAmortizacion: \{ select: \{ numeroPeriodo: true, fechaEsperada: true, interesPagado: true \} \}/)
  })
})

describe('el aviso dice «de atraso», no «sin pagar»', () => {
  /* Los días cuentan desde la cuota más vieja sin cubrir. Quien pagó el interés
     ayer SÍ pagó: «32 días sin pagar» con «Últ. pago 20 sep» en la misma
     tarjeta es lo que hizo creer que el pago no se había registrado. */
  it('en la parada, en la ficha del cliente y en la del préstamo', () => {
    expect(leer('components/cf/ParadaDeCobro.jsx')).toContain('Lleva <b>{avisoMora.dias} días de atraso</b>.')
    expect(leer('lib/tips/clienteTips.js')).toContain('titular: `Lleva ${maxMora} días de atraso.`')
    expect(leer('lib/tips/prestamoTips.js')).toContain('return `Lleva ${prestamo.diasMora} días de atraso — último pago fue el')
    for (const f of ['components/cf/ParadaDeCobro.jsx', 'lib/tips/clienteTips.js', 'lib/tips/prestamoTips.js']) {
      expect(leer(f), f).not.toMatch(/Lleva (<b>)?\{?\$?\{?[a-zA-Z.]+\}? días sin pagar/)
    }
  })
})
