/**
 * «QUE UNO MISMO PUEDA DECIR: ESTO ES INTERÉS Y ESTO ES CAPITAL» (Créditos pete, 11 nov 2026).
 *
 * Dos cosas que él pidió:
 *  1. Al pasar un préstamo abierto, el interés que él dice que cobró se guarda
 *     entero, aunque pase de lo que cuenta el calendario. Antes el formulario lo
 *     frenaba («De interés caben…») y la diferencia se iba a capital: Rafa
 *     mamatoco quedó justo en el tope.
 *  2. «Que el sistema no me cobre por días»: con «cobro el mes completo»
 *     encendido en el negocio, «Si paga todo hoy» de un préstamo por cuotas sale
 *     con el mes completo (Laura: $402.000, no $351.600).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  devengosPendientes, periodoEnCursoAbierto, calcularSaldoPendiente, calcularCapitalRestante,
  calcularDiasMora, interesCobrableAhora, calcularLiquidacionAnticipada, conCierreDelNegocio,
} from '@/lib/calculos'
import { NOTA_INTERES_YA_COBRADO, esAbonoPrevio } from '@/lib/dinero/abono-previo'

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const T = (d) => new Date(`${d}T05:00:00.000Z`)
const el11 = new Date('2026-11-11T20:00:00Z').getTime()

describe('el interés de más queda como interés, y el capital como él lo puso', () => {
  // Rafa: $1.000.000 el 2 sep, 12 % al mes en quincenas (6 %), días 15 y 30.
  // Dice que le cobró $360.000 de interés; el calendario cuenta $300.000.
  const base = {
    id: 'x', modoInteres: 'solo_interes', sinPlazo: true, estado: 'activo', interesMesCompleto: true, interesPorMes: true,
    frecuencia: 'quincenal', tasaInteres: 6, montoPrestado: 1000000, fechaInicio: T('2026-09-02'), primerCobro: null,
    diaCobroMes: 15, diaCobroMes2: 30, diaCobroSemana: null, cuotasAmortizacion: [],
  }
  const capital = [{ tipo: 'capital', montoPagado: 480000, fechaPago: T('2026-11-06') }]
  const cerrados = devengosPendientes({ ...base, devengos: [], pagos: capital }, el11)
  const enCurso = periodoEnCursoAbierto({ ...base, devengos: cerrados, pagos: capital }, el11)
  const devengos = [...cerrados, { periodo: enCurso.periodo, capitalBase: enCurso.capitalBase, interes: enCurso.interesPeriodo }]
  const techo = devengos.reduce((a, d) => a + d.interes, 0)
  const deMas = 360000 - techo
  const rafa = {
    ...base, devengos,
    pagos: [
      { tipo: 'intereses', montoPagado: 360000, fechaPago: T('2026-09-02') },
      { tipo: 'recargo', montoPagado: deMas, fechaPago: T('2026-09-02'), nota: NOTA_INTERES_YA_COBRADO },
      ...capital,
    ],
    totalAPagar: 1000000 + techo + deMas,
  }
  it('el calendario cuenta $300.000 y él dijo $360.000: $60.000 de más', () => {
    expect([techo, deMas]).toEqual([300000, 60000])
  })
  it('debe $520.000, todo capital, al día y sin interés por cobrar', () => {
    expect(calcularSaldoPendiente(rafa)).toBe(520000)
    expect(calcularCapitalRestante(rafa)).toBe(520000)
    expect(calcularDiasMora(rafa, [], [], el11)).toBe(0)
    expect(interesCobrableAhora(rafa)).toBe(0)
  })
  it('la nota no se confunde con el abono previo', () => {
    expect(esAbonoPrevio({ nota: NOTA_INTERES_YA_COBRADO })).toBe(false)
  })
})

describe('el servidor y el formulario', () => {
  const post = leer('app/api/prestamos/route.js')
  const form = leer('app/(dashboard)/prestamos/nuevo/page.jsx')
  it('ya no rechaza el interés que pasa del calendario: lo apunta', () => {
    expect(post).not.toMatch(/error: techo > 0/)
    expect(post).toMatch(/if \(abonoInteres > techo\) interesYaCobrado = Math\.round\(abonoInteres - techo\)/)
  })
  it('el recargo sube la deuda en lo mismo, con su nota', () => {
    expect(post).toMatch(/montoPagado: interesYaCobrado, tipo: 'recargo',/)
    expect(post).toMatch(/nota: NOTA_INTERES_YA_COBRADO,/)
    expect(post).toMatch(/data: \{ totalAPagar: \{ increment: interesYaCobrado \} \}/)
  })
  it('en las dos vías de crear: la normal y la que espera aprobación', () => {
    expect(post.split('await apuntarInteresYaCobrado(tx, nuevo.id)').length - 1).toBe(2)
    expect(post.indexOf('const apuntarInteresYaCobrado')).toBeLessThan(post.indexOf('await apuntarInteresYaCobrado(tx, nuevo.id)'))
  })
  it('el formulario lo cuenta y no lo pinta de rojo', () => {
    expect(form).not.toMatch(/No se puede guardar más que eso como interés/)
    expect(form).toMatch(/const avisoRojo = tipoAbonoPrevio === 'separado' && \(!\(deInteres > 0\) \|\| \(!fechaAbonoCapital && deCapital > 0\)\)/)
  })
})

describe('«Si paga todo hoy» sin días cuando el negocio cobra el mes completo', () => {
  // Laura: cuotas fijas, $600.000 el 2 sep al 12 %, 6 quincenas de $136.000, abonó $414.000.
  const laura = {
    id: 'l', modoInteres: 'fijo', sinPlazo: false, estado: 'activo', frecuencia: 'quincenal', tasaInteres: 12,
    montoPrestado: 600000, totalAPagar: 816000, diasPlazo: 90, fechaInicio: T('2026-09-02'), fechaFin: T('2026-12-01'),
    diaCobroMes: 1, diaCobroMes2: 16, cuotasAmortizacion: [], devengos: [],
    pagos: [{ tipo: 'completo', montoPagado: 414000, fechaPago: T('2026-09-02') }],
  }
  const liq = calcularLiquidacionAnticipada(laura, new Date(el11))
  it('con la opción, sale el mes completo: lo que debe, sin descuento por días', () => {
    expect(conCierreDelNegocio(liq, true).porDefecto.restanteHoy).toBe(402000)
  })
  it('sin la opción, como siempre', () => {
    expect(conCierreDelNegocio(liq, false).porDefecto).toBeUndefined()
  })
  it('el abierto trae la suya y no se toca', () => {
    const ab = { porDefecto: { modalidad: 'proporcional' }, mesCompleto: { modalidad: 'mesCompleto' } }
    expect(conCierreDelNegocio(ab, true).porDefecto.modalidad).toBe('proporcional')
  })
  it('las dos vías que lo calculan leen la opción del negocio', () => {
    expect(leer('app/api/prestamos/[id]/liquidacion/route.js')).toMatch(/organization: \{ select: \{ diasSinCobro: true, interesMesCompletoDefault: true \} \}/)
    const cli = leer('app/api/clientes/[id]/route.js')
    expect(cli).toMatch(/select: \{ diasSinCobro: true, interesMesCompletoDefault: true \}/)
    expect(cli).toMatch(/conCierreDelNegocio\(calcularLiquidacionAnticipada\(p, new Date\(\), diasExcluidos, festivos\), !!org\?\.interesMesCompletoDefault\)/)
  })
})
