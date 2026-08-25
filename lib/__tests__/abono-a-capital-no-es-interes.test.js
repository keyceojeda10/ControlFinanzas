// lib/__tests__/abono-a-capital-no-es-interes.test.js
//
// ══ EL MISMO PAGO, PARTIDO DE TRES FORMAS ══════════════════════════════════
//
// Crediya lo cazó haciendo la resta a mano, con las dos pantallas delante:
//
//   «Carlos, como puedes observar, en los intereses ganados aparecen
//    1.586.706. En *toda tu plata*, ¿no debería decir 51.586.706?»
//                                                          — 25 ago 2026
//
// Le faltaban $597.461. Quinientos mil eran un préstamo borrado de un día ya
// cerrado —eso es por diseño— y los otros **$97.461 eran esto**: sus $171.000
// declarados como ABONO A CAPITAL pasando por la tabla de amortización y
// saliendo con interés encima.
//
// La regla ya estaba escrita, a medias, en tres sitios:
//
//   `repartirPagado` (JS)      capital → 100% capital ✓   intereses → 100% ✓
//   `repartoSql`     (SQL)     capital → SE REPARTÍA ✗    intereses → 100% ✓
//   `interesPagoAPago`         capital → SE REPARTÍA ✗    intereses → SE REPARTÍA ✗
//
// No es «inventar el reparto» de `06-ADENDA-modos-sin-tabla.md`: esa regla
// prohíbe ADIVINAR cuánto de un pago NORMAL fue interés. Aquí no se adivina
// nada, lo declaró el prestamista al registrarlo.
//
// Medido en el espejo: 49 abonos a capital por $22.875.665 en 16 negocios, y
// 61 pagos de solo interés por $13.721.200 en 19.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'
import { repartirPagado, repartoSql } from '@/lib/dinero/reparto'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Un francés como los suyos: cuota fija, el interés cargado al principio. */
const CUOTAS = [
  { numeroPeriodo: 1, cuotaTotal: 100_000, interes: 60_000 },
  { numeroPeriodo: 2, cuotaTotal: 100_000, interes: 45_000 },
  { numeroPeriodo: 3, cuotaTotal: 100_000, interes: 25_000 },
]
const PRESTAMO = { modoInteres: 'saldo', montoPrestado: 170_000, totalAPagar: 300_000 }

describe('⚠ un abono a capital no lleva interés dentro', () => {
  it('el abono entero baja capital', () => {
    const filas = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [{ montoPagado: 50_000, tipo: 'capital', fechaPago: '2026-08-01' }],
    })
    expect(filas[0].interes, 'le sacaba interés a un abono').toBe(0)
    expect(filas[0].capital).toBe(50_000)
  })

  it('⚠ y NO empuja la tabla para los que vienen detrás', () => {
    /* El acumulado marca por dónde va la tabla. Si el abono lo moviera, el
       cobro siguiente entraría en un tramo que no le toca y saldría con menos
       interés del que de verdad ganó. `repartirPagado` lo deja fuera de
       `aRepartir` por lo mismo. */
    const conAbono = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [
        { montoPagado: 50_000, tipo: 'capital', fechaPago: '2026-08-01' },
        { montoPagado: 100_000, tipo: 'completo', fechaPago: '2026-08-02' },
      ],
    })
    const sinAbono = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [{ montoPagado: 100_000, tipo: 'completo', fechaPago: '2026-08-02' }],
    })
    expect(conAbono[1].interes).toBe(sinAbono[0].interes)
    expect(conAbono[1].interes).toBe(60_000)   // la cuota 1 entera
  })

  it('un pago de SOLO INTERÉS es todo interés', () => {
    const filas = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [{ montoPagado: 30_000, tipo: 'intereses', fechaPago: '2026-08-01' }],
    })
    expect(filas[0].interes).toBe(30_000)
    expect(filas[0].capital).toBe(0)
  })

  it('el pago corriente sigue repartiéndose por la tabla', () => {
    /* Lo que NO puede pasar: que al sacar los declarados se dejen de repartir
       los normales, que es de lo que va toda la función. */
    const filas = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [{ montoPagado: 100_000, tipo: 'completo', fechaPago: '2026-08-01' }],
    })
    expect(filas[0].interes).toBe(60_000)
    expect(filas[0].capital).toBe(40_000)
  })

  it('capital + interés sigue siendo exactamente lo pagado', () => {
    const filas = interesPagoAPago({
      prestamo: PRESTAMO, cuotas: CUOTAS,
      pagos: [
        { montoPagado: 100_000, tipo: 'completo' },
        { montoPagado: 50_000, tipo: 'capital' },
        { montoPagado: 30_000, tipo: 'intereses' },
        { montoPagado: 100_000, tipo: 'parcial' },
      ],
    })
    for (const f of filas) expect(f.interes + f.capital).toBe(f.monto)
  })
})

describe('⚠ las tres formas de partir el pago dicen lo mismo', () => {
  it('el JS y el pago-a-pago coinciden sobre los mismos pagos', () => {
    const pagos = [
      { montoPagado: 100_000, tipo: 'completo' },
      { montoPagado: 50_000, tipo: 'capital' },
      { montoPagado: 100_000, tipo: 'completo' },
    ]
    const totalPagado = pagos.reduce((a, p) => a + p.montoPagado, 0)
    const porTotales = repartirPagado({ ...PRESTAMO, totalPagado, cuotasAmortizacion: CUOTAS, pagos })
    const pagoAPago = interesPagoAPago({ prestamo: PRESTAMO, cuotas: CUOTAS, pagos })
    const interes = Math.round(pagoAPago.reduce((a, f) => a + f.interes, 0))
    expect(interes, 'volvieron a separarse').toBe(Math.round(porTotales.interes))
  })

  it('el SQL saca el abono del reparto', () => {
    const { interes } = repartoSql({ porFila: true })
    expect(interes, 'el abono a capital volvía a llevar interés').toMatch(/p\.tipo = 'capital' THEN 0/)
    expect(interes).toMatch(/p\.tipo = 'intereses' THEN p\.montoPagado/)
  })

  it("⚠ el `select` pide `tipo`, sin el que nada de esto se aplica", () => {
    /* Un campo que existe y no se pide llega `undefined`: el predicado no
       acierta nunca, el reparto vuelve a ser el viejo y no revienta nada. Ya
       dejó cuatro días muerta la exclusión de reversos en la caja. */
    const src = leer('lib/dinero/interes-cobrado.js')
    const i = src.indexOf('pagos: {')
    expect(i).toBeGreaterThan(-1)
    expect(src.slice(i, i + 700)).toMatch(/select: \{[^}]*\btipo: true\b/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 *  «NO ENTENDÍ LO DEL PRÉSTAMO DE FRANK»
 *
 *  La otra mitad de su resta. Su préstamo a FRANK ALMANZA salió el 13 de
 *  agosto por $500.000 y él borró el préstamo el 19. Al borrarlo el sistema le
 *  devolvió el pago de $75.000 —ése era de ese momento— pero NO el desembolso,
 *  porque venía de un día YA CERRADO: devolverlo hoy rompería la caja del 13.
 *  Eso es a propósito (`esDelDiaAbierto`).
 *
 *  Lo que no era a propósito es que esos $500.000 desaparecieran del total sin
 *  una línea que lo dijera. Su cuenta, ya cuadrada en pantalla:
 *
 *      50.000.000 + 1.489.245 (interés, ya sin el abono) − 500.000 = 50.989.245
 * ══════════════════════════════════════════════════════════════════════════ */
describe('⚠ la plata que salió y no volvió se cuenta', () => {
  const api = leer('app/api/capital/resumen/route.js')
  const tab = leer('components/capital/CapitalTab.jsx')

  it('se netean TODOS los asientos del préstamo borrado', () => {
    /* Nelson Cantillo y Zully Villamizar netean cero —devolvieron todo— y solo
       Frank queda en negativo. Sumar solo los desembolsos los acusaría a los
       tres. */
    expect(api).toMatch(/SUM\(CASE WHEN m\.saldoNuevo >= m\.saldoAnterior THEN m\.monto ELSE -m\.monto END\)/)
    expect(api).toMatch(/HAVING neto < -0\.5/)
  })

  it('solo mira préstamos, y solo los que ya no existen', () => {
    /* El filtro son los `referenciaId` que alguna vez tuvieron un DESEMBOLSO:
       gastos e inyecciones usan el mismo campo apuntando a otra cosa. */
    expect(api).toMatch(/AND d\.tipo = 'desembolso'/)
    expect(api).toMatch(/NOT EXISTS \(SELECT 1 FROM Prestamo p WHERE p\.id = m\.referenciaId\)/)
  })

  it('⚠ y no se sale de la organización', () => {
    const i = api.indexOf('SELECT m.referenciaId AS id')
    expect(i).toBeGreaterThan(-1)
    expect(api.slice(i, i + 1200)).toMatch(/m\.organizationId = \$\{organizationId\}/)
  })

  it('la lista se corta y dice cuántos quedan', () => {
    /* Un negocio de la base tiene 23: veintitrés renglones en la pantalla que
       abre cada mañana es alarmar, no informar. */
    expect(api).toMatch(/const TOPE_LISTA = 4/)
    expect(api).toMatch(/mas: Math\.max\(0, casosTodos\.length - TOPE_LISTA\)/)
    expect(tab).toMatch(/préstamo\{resumen\.capitalNoDevuelto\.mas === 1 \? '' : 's'\} más/)
  })

  it('⚠ NO en rojo: no es una alarma, es una explicación', () => {
    const i = tab.indexOf('Salió y no volvió')
    const bloque = tab.slice(Math.max(0, i - 1800), i + 200)
    expect(bloque, 'el rojo dice «algo está mal» y aquí no lo está').not.toMatch(/cf-red-dark/)
  })

  it('el nombre del cliente no se recorta', () => {
    /* Es lo que identifica de qué préstamo se trata, y de un borrado ya no
       queda nada más. Ver `regla_no_recortar_identidad`. */
    const i = tab.indexOf('capitalNoDevuelto.casos.map')
    expect(i).toBeGreaterThan(-1)
    expect(tab.slice(i, i + 500)).toMatch(/overflowWrap: 'anywhere'/)
    expect(tab.slice(i, i + 500)).not.toMatch(/truncate|text-ellipsis/)
  })

  it('no se pinta cuando no hay nada que contar', () => {
    /* El cero es un dato, pero un bloque que dice «$0 salió y no volvió» es
       ruido en la pantalla del 95% que nunca borró un préstamo. */
    expect(tab).toMatch(/\(resumen\?\.capitalNoDevuelto\?\.monto \?\? 0\) > 0 &&/)
  })
})
