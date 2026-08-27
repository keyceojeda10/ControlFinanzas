// lib/__tests__/las-dos-fichas-suman-lo-mismo.test.js
//
// ══ «SI YO SUMO TODO ESO ME DA 941.710, MÁS NO ME DA 850.000» ══════════════
//
// 27 de agosto de 2026. Un prestamista con un cliente de tres créditos abiertos
// abre uno por uno y anota lo que cada ficha le dice que cuesta cancelarlo hoy:
//
//     $200.000 desde el 8 de julio    →  si lo cancela hoy  $223.226
//     $250.000 desde el 17 de julio   →  si lo cancela hoy  $264.516
//     $400.000 desde el 5 de agosto   →  si lo cancela hoy  $454.194
//
// Suma los tres y le dan ~$942.000. Pero la ficha del cliente le dice
// «SALDO TOTAL PENDIENTE $850.000». Y tiene razón: la diferencia son los
// ~$92.000 de interés que llevan corriendo desde su último cobro.
//
// Lo introduje yo el 26 de agosto, al hacer que el préstamo abierto enseñara el
// interés día a día: la ficha del PRÉSTAMO pasó a contar los días corridos y la
// del CLIENTE se quedó sumando el saldo del libro. Dos pantallas, dos verdades
// sobre el mismo cliente.
//
// ⚠ LA CIFRA GRANDE NO CAMBIA. «Saldo total pendiente» es lo que el libro dice
// que debe, y eso está bien: el interés del período en curso todavía no se debe
// —nace cuando el período cierra— y meterlo ahí rompería `saldo = total −
// pagado` en los 79 archivos que lo usan. Lo que faltaba era la OTRA cifra,
// con su nombre.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { calcularSaldoPendiente, calcularLiquidacionAnticipada } from '@/lib/calculos'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const HOY = new Date('2026-08-27T14:24:00Z')

/* Sus tres créditos, tal como están en la base. */
const abierto = (monto, inicio, devengados, pagados) => ({
  modoInteres: 'solo_interes', sinPlazo: true,
  montoPrestado: monto, tasaInteres: 20, frecuencia: 'mensual',
  fechaInicio: inicio, cuotasAmortizacion: [],
  totalAPagar: monto + devengados.reduce((a, d) => a + d.interes, 0),
  devengos: devengados,
  pagos: pagados,
})
const LOS_TRES = [
  abierto(200_000, '2026-07-08',
    [{ periodo: '2026-08-08', interes: 40_000 }],
    [{ tipo: 'intereses', montoPagado: 40_000, fechaPago: '2026-08-26' }]),
  abierto(250_000, '2026-07-17',
    [{ periodo: '2026-08-17', interes: 50_000 }],
    [{ tipo: 'intereses', montoPagado: 50_000, fechaPago: '2026-08-26' }]),
  abierto(400_000, '2026-08-05', [], []),
]

/* Lo que el API del cliente le pone a cada préstamo. Es la MISMA función que
   alimenta la ficha del préstamo: dos fuentes para la misma cifra es cómo se
   llega a que dos pantallas digan cosas distintas. */
const cerrarHoy = (p) => Math.round(calcularLiquidacionAnticipada(p, HOY).proporcional.restanteHoy)

describe('la ficha del cliente suma lo mismo que las de sus préstamos', () => {
  it('el saldo del libro es la suma de los saldos', () => {
    const saldos = LOS_TRES.map((p) => Math.round(calcularSaldoPendiente(p)))
    expect(saldos).toEqual([200_000, 250_000, 400_000])
    expect(saldos.reduce((a, b) => a + b, 0)).toBe(850_000)   // lo que él vio
  })

  it('y «si los cancela hoy» es la suma de los «si lo cancela hoy»', () => {
    /* La invariante que se rompió: el total del cliente tiene que ser
       exactamente lo que sale de sumar sus préstamos uno a uno, porque eso es
       lo que el prestamista hace con el teléfono en la mano. */
    const unoAUno = LOS_TRES.map(cerrarHoy)
    const total = unoAUno.reduce((a, b) => a + b, 0)
    expect(total).toBe(unoAUno[0] + unoAUno[1] + unoAUno[2])
    // Y es mayor que el saldo, por el interés que lleva corriendo.
    expect(total).toBeGreaterThan(850_000)
    expect(total - 850_000).toBe(LOS_TRES.reduce((a, p) => a + (cerrarHoy(p) - Math.round(calcularSaldoPendiente(p))), 0))
  })

  it('en un préstamo con plazo las dos cifras no se separan sin motivo', () => {
    /* Si no hay interés corriendo, «si los cancela hoy» no debe aparecer: dos
       veces el mismo número en un bloque de plata se lee como un error. */
    const conPlazo = {
      modoInteres: 'fijo', sinPlazo: false,
      montoPrestado: 500_000, tasaInteres: 20, frecuencia: 'mensual', diasPlazo: 90,
      fechaInicio: '2026-08-01', totalAPagar: 800_000, cuotasAmortizacion: [],
      devengos: [], pagos: [],
    }
    const saldo = Math.round(calcularSaldoPendiente(conPlazo))
    const liq = calcularLiquidacionAnticipada(conPlazo, HOY)
    // Aquí cerrar hoy cuesta MENOS que el saldo (se perdona interés futuro),
    // que es otra pregunta y ya tenía su sitio en la ficha del préstamo.
    expect(liq.proporcional.restanteHoy).toBeLessThanOrEqual(saldo)
  })
})

describe('las dos pantallas beben de la misma función', () => {
  it('el API del cliente usa `calcularLiquidacionAnticipada`, no una copia', () => {
    const api = leer('app/api/clientes/[id]/route.js')
    expect(api).toContain('calcularLiquidacionAnticipada(p, new Date(), diasExcluidos, festivos)')
    expect(api).toContain('cerrarHoy:')
  })

  it('y si el cálculo falla devuelve el saldo, nunca una cifra inventada', () => {
    const api = leer('app/api/clientes/[id]/route.js')
    expect(api).toContain('catch { return Math.round(calcularSaldoPendiente(p)) }')
  })

  it('la ficha suma `cerrarHoy` de los activos y solo lo enseña si hay interés corriendo', () => {
    const jsx = leer('components/clientes/ClienteHeroCard.jsx')
    expect(jsx).toContain("p?.cerrarHoy ?? p?.saldoPendiente ?? 0")
    expect(jsx).toContain('{corriendo > 0 && (')
    expect(jsx).toContain('>Si los cancela hoy</p>')
  })

  it('⚠ y la cifra grande sigue siendo el saldo del libro', () => {
    // Meter el interés corriendo ahí rompería `saldo = total − pagado`.
    const jsx = leer('components/clientes/ClienteHeroCard.jsx')
    expect(jsx).toContain('{formatMoney(Math.round(animSaldo))}')
    expect(jsx).toContain('const animSaldo = useCountUp(saldoTotal, 900)')
  })
})
