// lib/__tests__/interes-perdonado-no-es-perdida.test.js
//
// ══ PRESTÓ $900.000, LE DEVOLVIERON $900.000, Y EL LIBRO DECÍA −$306.973 ════
//
// Crediya lo cazó restando a mano, con las dos pantallas delante: su patrimonio
// no le cuadraba con el capital inicial más la ganancia. Desglosado hasta el
// peso, su préstamo a Jose Bermejo:
//
//     −900.000  desembolso
//     +100.000  abono a capital
//     +800.000  liquidación anticipada
//     −306.973  «interés perdonado por pago anticipado»   ← aquí
//     −800.000  reverso del pago
//     +800.000  pago recibido
//     ────────
//     −306.973  neto
//
// Prestó novecientos mil y le devolvieron novecientos mil. Su capital está
// entero. Los $306.973 son interés al que RENUNCIÓ, y ese interés nunca estuvo
// en la caja: restarlo inventa una pérdida.
//
// ⚠ EL FALLO YA ESTABA ESCRITO EN EL REPO, en `afectaCaja`: «bajan la CARTERA,
//   no la bolsa; pero como `disponibleHoy = Capital.saldo`, la resta es
//   permanente y acumulativa». Se parcheó la conciliación y no la raíz.
//
// Medido en el espejo: 43 asientos así, en 8 negocios, $25.427.487 desde el 5
// de junio de 2026.
//
// ── Y LA SEGUNDA MITAD ────────────────────────────────────────────────────
//
// Al liquidar, el sistema baja `totalAPagar` pero NO reescribe la tabla de
// amortización. Quien reparte por la tabla seguía cobrándose el interés
// perdonado: el informe le decía a Crediya que ganó **$283.479** con Jose
// Bermejo, cuando le perdonó hasta el último peso.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { techoDeInteres, repartirPagado } from '@/lib/dinero/reparto'
import { interesPagoAPago } from '@/lib/dinero/interes-cobrado'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')

/* Su préstamo, con la tabla tal como está en la base: 13 cuotas que suman
   $306.973 de interés, y un `totalAPagar` ya bajado a los $900.000 exactos. */
const TABLA = [
  { numeroPeriodo: 1, cuotaTotal: 85_200, capital: 45_200, interes: 40_000 },
  { numeroPeriodo: 2, cuotaTotal: 85_200, capital: 47_460, interes: 37_740 },
  { numeroPeriodo: 3, cuotaTotal: 85_200, capital: 49_833, interes: 35_367 },
  { numeroPeriodo: 4, cuotaTotal: 85_200, capital: 52_325, interes: 32_875 },
  { numeroPeriodo: 5, cuotaTotal: 85_200, capital: 54_941, interes: 30_259 },
  { numeroPeriodo: 6, cuotaTotal: 85_200, capital: 57_688, interes: 27_512 },
  { numeroPeriodo: 7, cuotaTotal: 85_200, capital: 60_572, interes: 24_628 },
  { numeroPeriodo: 8, cuotaTotal: 85_200, capital: 63_601, interes: 21_599 },
  { numeroPeriodo: 9, cuotaTotal: 85_200, capital: 66_781, interes: 18_419 },
  { numeroPeriodo: 10, cuotaTotal: 85_200, capital: 70_120, interes: 15_080 },
  { numeroPeriodo: 11, cuotaTotal: 85_200, capital: 73_626, interes: 11_574 },
  { numeroPeriodo: 12, cuotaTotal: 85_200, capital: 77_307, interes: 7_893 },
  { numeroPeriodo: 13, cuotaTotal: 84_573, capital: 80_546, interes: 4_027 },
]
const BERMEJO = {
  modoInteres: 'saldo',
  montoPrestado: 900_000,
  totalAPagar: 900_000,      // bajado al liquidar: se le perdonó TODO el interés
  totalPagado: 900_000,
  cuotasAmortizacion: TABLA,
  pagos: [
    { montoPagado: 100_000, tipo: 'capital', fechaPago: '2026-08-14' },
    { montoPagado: 800_000, tipo: 'completo', fechaPago: '2026-08-26' },
  ],
}

describe('⚠ el interés que se perdonó no se cobra en el reparto', () => {
  it('el techo es lo pactado por encima de lo prestado', () => {
    expect(techoDeInteres(BERMEJO)).toBe(0)
    expect(techoDeInteres({ montoPrestado: 500_000, totalAPagar: 600_000 })).toBe(100_000)
  })

  it('⚠ y el préstamo cerrado en PÉRDIDA no da interés negativo', () => {
    /* Ahí no hay ganancia que repartir, hay capital perdido — y eso lo dice
       `capitalPerdido`, con su nombre. */
    expect(techoDeInteres({ montoPrestado: 1_500_000, totalAPagar: 900_000 })).toBe(0)
  })

  it('Jose Bermejo, pago a pago: ganancia CERO', () => {
    const filas = interesPagoAPago({
      prestamo: BERMEJO, cuotas: TABLA, pagos: BERMEJO.pagos,
    })
    const interes = Math.round(filas.reduce((a, f) => a + f.interes, 0))
    expect(interes, 'le contaba el interés que perdonó').toBe(0)
    expect(interes).not.toBe(283_479)
    // Y la plata no se pierde de vista: todo lo cobrado fue capital.
    expect(Math.round(filas.reduce((a, f) => a + f.capital, 0))).toBe(900_000)
  })

  it('Jose Bermejo, por totales: lo mismo', () => {
    /* Las dos formas de repartir tienen que decir lo mismo, y por eso el techo
       va en las DOS. */
    const r = repartirPagado(BERMEJO)
    expect(r.interes).toBe(0)
    expect(r.capital).toBe(900_000)
  })

  it('un préstamo normal no cambia: el techo no muerde', () => {
    /* ⚠ `montoPrestado: 800_000`, que es el capital que describe ESTA tabla
       —suma 800.000 en la columna de capital—. Con los 900.000 del préstamo
       real el techo baja a 206.973 y muerde: la tabla se había reconstruido
       tras el abono a capital de 100.000. Me pasó al escribir la prueba. */
    const normal = {
      ...BERMEJO,
      montoPrestado: 800_000,
      totalAPagar: 1_106_973,   // los $800.000 del calendario más su interés
      totalPagado: 800_000,
      pagos: [{ montoPagado: 800_000, tipo: 'completo' }],
    }
    const filas = interesPagoAPago({ prestamo: normal, cuotas: TABLA, pagos: normal.pagos })
    expect(Math.round(filas.reduce((a, f) => a + f.interes, 0))).toBe(283_479)
  })
})

describe('⚠ el asiento se apunta pero no baja la caja', () => {
  const capital = leer('lib/capital.js')
  const pagos = leer('app/api/prestamos/[id]/pagos/route.js')

  it('`noMueveCapital` deja los dos saldos iguales', () => {
    expect(capital).toMatch(/noMueveCapital = false/)
    expect(capital).toMatch(/const saldoNuevo = \(ajusteArranqueRuta \|\| noMueveCapital\)/)
  })

  it('⚠ y tampoco toca la bolsa de la ruta', () => {
    /* Si bajara el `saldoCapital` de la ruta, la caja del cobrador diría que le
       falta una plata que nadie se llevó: el mismo fallo un piso más abajo. */
    expect(capital).toMatch(/if \(rutaId && !noMueveCapital\)/)
  })

  it('la liquidación lo usa', () => {
    const i = pagos.indexOf("tipo === 'liquidacion' && interesPerdonado > 0")
    expect(i).toBeGreaterThan(-1)
    expect(pagos.slice(i, i + 700)).toMatch(/noMueveCapital: true/)
  })

  it('⚠ los que leen la dirección por el saldo lo saltan', () => {
    /* Con los dos saldos iguales, `saldoNuevo >= saldoAnterior` lo lee como
       INGRESO: sumaría una plata que nadie metió. */
    /* ⚠ LA GUARDA SALIÓ DEL BUCLE Y SE VOLVIÓ `noMovioNada`, PORQUE ESTABA EN
       UN SOLO SITIO Y HAY TRES QUE LEEN LA DIRECCIÓN IGUAL. Lo cazó una
       revisión adversarial el 27 ago: sin ella en el segundo bucle, «Le queda
       en la ruta» se separaba de `Ruta.saldoCapital` por el importe entero del
       descuento y «Volvió al capital de la ruta» escribía un ingreso que no
       existe. Es el «arreglé una vía y dejé la otra» de siempre. */
    const caja = leer('app/api/caja/cobrador/[id]/route.js')
    const i = caja.indexOf('const noMovioNada = (m) =>')
    expect(i, 'no encuentro la guarda').toBeGreaterThan(0)
    expect(caja.slice(i, i + 400)).toMatch(/Math\.round\(m\.saldoAnterior\) === Math\.round\(m\.saldoNuevo\)/)
    // Y el de arranque de ruta NO se salta: ése sí mueve la bolsa a propósito.
    expect(caja.slice(i, i + 400)).toMatch(/!m\.ajusteArranqueRuta/)
    // Y se aplica en los TRES sitios que leen la dirección por el saldo.
    expect(caja.split('noMovioNada(m)').length - 1).toBeGreaterThanOrEqual(3)

    const resumen = leer('app/api/capital/resumen/route.js')
    const j = resumen.indexOf("if (mov.tipo === 'ajuste')")
    expect(resumen.slice(j, j + 500)).toMatch(/Math\.round\(mov\.saldoAnterior\) === Math\.round\(mov\.saldoNuevo\)\) return acc/)
  })

  it('`afectaCaja` ya reconocía esa marca, y por eso se usa', () => {
    const conc = leer('lib/dinero/conciliacion.js')
    expect(conc).toMatch(/Math\.round\(antes\) === Math\.round\(despues\)/)
  })
})

/* ══════════════════════════════════════════════════════════════════════════
 *  ⚠ Y EL DESCUENTO ES EL MISMO FALLO, UN PASO MÁS LEJOS
 *
 *  Perdonarle deuda a un cliente no saca un billete de ningún sitio. La
 *  pérdida ya la enseña la CARTERA —el descuento baja `totalAPagar`, y con él
 *  lo que queda en la calle— así que restarla también del capital la cuenta
 *  DOS VECES.
 *
 *  Medido en dos casos concretos, hasta el peso:
 *
 *      GERMAN EDUARDO  prestó 120.000, cobró 0, perdonó todo
 *                      el libro le restó 240.000 · perdió 120.000
 *      Abigail Castro  prestó 200.000, cobró 0, perdonó 240.000
 *                      el libro le restó 440.000 · perdió 200.000
 *
 *  A Abigail le restó MÁS DE LO QUE LE PRESTÓ: el descuento perdona capital e
 *  interés juntos, y el interés nunca estuvo en la caja.
 *
 *  Sin el egreso, la cuenta sale sola: el desembolso ya salió y no volvió, así
 *  que el patrimonio baja exactamente lo perdido. Y si el descuento solo
 *  perdona interés —el cliente ya devolvió el capital— no baja nada, que es lo
 *  correcto.
 * ══════════════════════════════════════════════════════════════════════════ */
describe('⚠ un descuento no saca plata de la caja', () => {
  const pagos = leer('app/api/prestamos/[id]/pagos/route.js')

  it('el descuento se apunta pero no baja el capital', () => {
    const i = pagos.indexOf("if (tipo === 'descuento') {\n      await registrarMovimientoCapital")
    expect(i, 'no encuentro el asiento del descuento').toBeGreaterThan(-1)
    expect(pagos.slice(i, i + 1200)).toMatch(/noMueveCapital: true/)
  })

  it('⚠ y sus DOS reversos van a la par', () => {
    /* Si el descuento no mueve la caja, deshacerlo tampoco puede meter una
       plata que nunca salió. Son dos sitios: anular el pago y borrar el
       préstamo. */
    for (const [arch, marca] of [
      ['app/api/pagos/[id]/route.js', 'Reverso descuento anulado - préstamo'],
      ['app/api/prestamos/[id]/route.js', 'Reverso descuento - préstamo eliminado'],
    ]) {
      const src = leer(arch)
      const i = src.indexOf(marca)
      expect(i, `${arch}: no encuentro el reverso`).toBeGreaterThan(-1)
      expect(src.slice(i, i + 500), `${arch}: el reverso sigue moviendo la caja`)
        .toMatch(/noMueveCapital: true/)
    }
  })

  it('la conciliación ya los daba por «sin efecto», y sigue', () => {
    const conc = leer('lib/dinero/conciliacion.js')
    expect(conc).toMatch(/\^Descuento aplicado/)
    expect(conc).toMatch(/\^Reverso descuento/)
  })
})
