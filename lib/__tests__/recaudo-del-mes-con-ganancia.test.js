// lib/__tests__/recaudo-del-mes-con-ganancia.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Lo que más uso son los reportes, pero sí sería bueno que en estos reportes
//  estén de manera clara y específica los recaudos del mes.»
//   — Miguel Ángel (Préstamos Rincón), por el banner de sugerencias, 15 ago 2026.
//
// El informe de ingresos daba el TOTAL y nada más. Para quien presta, el total
// es la mitad de la respuesta: de lo que entró, una parte es capital que ya era
// suyo y vuelve, y otra es lo que ganó.
//
// ⚠ Y no vale repartirlo por proporción. Sus 20 préstamos son mensuales, 18 en
//   «sobre saldo», los 20 con tabla. Ahí las primeras cuotas son casi todo
//   interés, y el reparto plano se queda corto: medido contra su base,
//   **$141.889 contra $232.119 reales — un 64% de menos**. Y de paso le inflaba
//   el «capital recuperado», que es la otra cifra que necesita para declarar.
//
// Alcance: 526 préstamos con tabla en 41 negocios.
//
// Lo que estas pruebas cuidan:
//
//   1. Que el desglose por días vuelva a repartirse por proporción.
//   2. Que el desglose no sume el total que se enseña encima.
//   3. Que se calcule el interés con SOLO los pagos del período. El interés de
//      un pago depende de por dónde iba la tabla cuando entró.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { interesPagoAPago, interesCobradoDelPrestamo } from '@/lib/dinero/interes-cobrado'

const d = (s) => new Date(`${s}T05:00:00.000Z`)

/* Un «sobre saldo» como los suyos: $1.000.000 a 12 meses, cuota fija, y las
   primeras cuotas casi todo interés. */
const sobreSaldo = {
  montoPrestado: 1000000,
  totalAPagar: 1200000,
  modoInteres: 'saldo',
  cuotasAmortizacion: [
    { numeroPeriodo: 1, cuotaTotal: 100000, interes: 50000 },
    { numeroPeriodo: 2, cuotaTotal: 100000, interes: 45000 },
    { numeroPeriodo: 3, cuotaTotal: 100000, interes: 40000 },
    { numeroPeriodo: 4, cuotaTotal: 100000, interes: 35000 },
  ],
  pagos: [
    { montoPagado: 100000, fechaPago: d('2026-07-05') },
    { montoPagado: 100000, fechaPago: d('2026-08-05') },
    { montoPagado: 100000, fechaPago: d('2026-08-20') },
  ],
}

const filas = () => interesPagoAPago({
  prestamo: sobreSaldo,
  cuotas: sobreSaldo.cuotasAmortizacion,
  pagos: sobreSaldo.pagos,
})

describe('⚠ el interés sale de la tabla, no de una proporción', () => {
  it('la primera cuota es casi todo interés, como dice su tabla', () => {
    /* Por proporción cada pago daría 1.200.000−1.000.000 / 1.200.000 = 16,7%,
       o sea $16.667. La tabla dice $50.000. Es la diferencia que él notó. */
    expect(filas()[0].interes).toBe(50000)
    expect(Math.round(100000 * ((1200000 - 1000000) / 1200000))).toBe(16667)
  })

  it('y va bajando cuota a cuota', () => {
    expect(filas().map((f) => f.interes)).toEqual([50000, 45000, 40000])
  })

  it('⚠ interés + capital = lo que pagó, en cada uno', () => {
    /* El capital sale por resta a propósito: así no se pierde un peso de vista
       ni aparecen por redondeo. */
    for (const f of filas()) expect(f.interes + f.capital).toBe(f.monto)
  })
})

describe('⚠ el desglose suma el total que se enseña encima', () => {
  it('los pagos del mes suman lo que dice el total del mes', () => {
    const agosto = filas().filter((f) => f.fecha >= d('2026-08-01') && f.fecha < d('2026-09-01'))
    const porFilas = agosto.reduce((s, f) => s + f.interes, 0)
    const enBloque = interesCobradoDelPrestamo({
      prestamo: sobreSaldo, cuotas: sobreSaldo.cuotasAmortizacion, pagos: sobreSaldo.pagos,
      desde: d('2026-08-01'), hasta: d('2026-08-31'),
    })
    expect(porFilas).toBe(enBloque)
  })

  it('⚠ el pago de julio mueve la tabla aunque no se cuente', () => {
    /* Si se calculara solo con los pagos de agosto, el primero de agosto se
       tomaría por el primero del préstamo y daría $50.000 en vez de $45.000. */
    const agosto = filas().filter((f) => f.fecha >= d('2026-08-01'))
    expect(agosto[0].interes).toBe(45000)
  })
})

describe('el informe de ingresos usa esa cuenta y no otra', () => {
  const src = readFileSync(resolve(process.cwd(), 'app/api/reportes/ingresos/route.js'), 'utf8')

  it('llama a la pieza compartida', () => {
    expect(src).toMatch(/interesPagoAPago\(\{ prestamo: pr/)
    expect(src).toMatch(/SELECT_PARA_INTERES/)
  })

  it('devuelve el reparto, no solo el total', () => {
    expect(src).toMatch(/interes: Math\.round\(totales\.interes\)/)
    expect(src).toMatch(/capital: Math\.round\(totales\.capital\)/)
  })

  it('⚠ trae TODOS los pagos del préstamo, no solo los del período', () => {
    /* El filtro por fecha va en el `where` del PRÉSTAMO (que haya cobrado en el
       período), no en el de sus pagos. Si se filtraran los pagos, el acumulado
       arrancaría en cero y el primero del mes saldría de más. */
    const consulta = src.slice(src.indexOf('prisma.prestamo.findMany'), src.indexOf('const claveDe'))
    expect(consulta).toMatch(/pagos: \{\s*some: \{/)
  })

  it('la pantalla lo pinta', () => {
    const pagina = readFileSync(resolve(process.cwd(), 'app/(dashboard)/reportes/page.jsx'), 'utf8')
    expect(pagina).toMatch(/setRepartoIngresos\(i\.totales/)
    expect(pagina).toMatch(/reparto=\{repartoIngresos\}/)
    const comp = readFileSync(resolve(process.cwd(), 'components/pantallas/ReportesDetalle.jsx'), 'utf8')
    expect(comp).toMatch(/Ganancia \(interés\)/)
    expect(comp).toMatch(/Capital que vuelve/)
  })
})
