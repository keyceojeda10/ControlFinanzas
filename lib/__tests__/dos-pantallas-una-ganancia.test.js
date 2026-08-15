// lib/__tests__/dos-pantallas-una-ganancia.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «1) Dashboard: intereses cobrado del mes $135.417 […] 2) Cómo va mi negocio:
//  ganancias del mes $215.019. En estas dos secciones solo la segunda es
//  correcta.»
//   — Miguel Ángel (Préstamos Rincón), ticket del 12 ago 2026.
//
// Tenía razón en cuál, aunque no en el porqué: lo atribuyó a los gastos, y los
// gastos estaban en cero. La diferencia era otra:
//
//   · El DASHBOARD repartía cada pago por la PROPORCIÓN del préstamo entero.
//   · ANALÍTICAS corregía además los préstamos con tabla con el interés que
//     dice la tabla.
//
// En un préstamo francés las primeras cuotas son casi todo interés, así que la
// proporción se queda corta. Reproducido contra su base: $135.417 y $215.019, y
// los $79.602 de diferencia salen de sus siete préstamos en modo `saldo`.
//
// Lo que estas pruebas cuidan:
//
//   1. Que la tabla vuelva a ignorarse cuando existe. Es la cifra de ganancia
//      del negocio: en 16 de 17 negocios cambiaba, y a uno le faltaban $4,2M.
//   2. Que se pierda el historial anterior a la ventana. El interés de un pago
//      depende de por dónde va la tabla, y eso lo dice lo pagado ANTES.
//   3. Que el dashboard vuelva a tener su propia cuenta escrita a mano.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { interesCobradoDelPrestamo, interesCobradoDeLosPrestamos } from '@/lib/dinero/interes-cobrado'

const d = (s) => new Date(`${s}T12:00:00.000Z`)

/* Un préstamo francés como los de Préstamos Rincón: $1.000.000, y la tabla
   carga el interés al principio. La proporción plana daría 20% de cada pago;
   la tabla dice que la primera cuota es 40% interés. */
const frances = {
  montoPrestado: 1_000_000,
  totalAPagar: 1_250_000,
  modoInteres: 'saldo',
  cuotasAmortizacion: [
    { numeroPeriodo: 1, cuotaTotal: 250_000, interes: 100_000 },
    { numeroPeriodo: 2, cuotaTotal: 250_000, interes: 70_000 },
    { numeroPeriodo: 3, cuotaTotal: 250_000, interes: 45_000 },
    { numeroPeriodo: 4, cuotaTotal: 250_000, interes: 25_000 },
    { numeroPeriodo: 5, cuotaTotal: 250_000, interes: 10_000 },
  ],
}

describe('⚠ con tabla manda la tabla, no la proporción', () => {
  it('la primera cuota es interés de verdad, no la fracción plana', () => {
    const conTabla = interesCobradoDelPrestamo({
      prestamo: frances,
      cuotas: frances.cuotasAmortizacion,
      pagos: [{ montoPagado: 250_000, fechaPago: d('2026-08-05') }],
    })
    const proporcion = interesCobradoDelPrestamo({
      prestamo: frances,
      cuotas: null,
      pagos: [{ montoPagado: 250_000, fechaPago: d('2026-08-05') }],
    })
    expect(Math.round(conTabla)).toBe(100_000)
    // (1.250.000 − 1.000.000) / 1.250.000 = 20% → $50.000
    expect(Math.round(proporcion)).toBe(50_000)
  })

  it('sin tabla se usa la proporción, que es lo correcto en esos modos', () => {
    const fijo = { montoPrestado: 100_000, totalAPagar: 120_000, modoInteres: 'fijo' }
    const r = interesCobradoDelPrestamo({
      prestamo: fijo, cuotas: [], pagos: [{ montoPagado: 60_000, fechaPago: d('2026-08-05') }],
    })
    expect(Math.round(r)).toBe(10_000)   // 1/6 de $60.000
  })

  it('⚠ un modo sin tabla NO se corrige aunque le pasen cuotas', () => {
    /* `MODOS_CON_TABLA` es la condición, no «tener filas». Un préstamo `fijo`
       con cuotas cargadas por error seguiría repartiéndose por proporción. */
    const r = interesCobradoDelPrestamo({
      prestamo: { ...frances, modoInteres: 'fijo' },
      cuotas: frances.cuotasAmortizacion,
      pagos: [{ montoPagado: 250_000, fechaPago: d('2026-08-05') }],
    })
    expect(Math.round(r)).toBe(50_000)
  })
})

describe('⚠ el historial anterior a la ventana hace falta', () => {
  const pagos = [
    { montoPagado: 250_000, fechaPago: d('2026-06-05') },
    { montoPagado: 250_000, fechaPago: d('2026-07-05') },
    { montoPagado: 250_000, fechaPago: d('2026-08-05') },
  ]

  it('el pago de agosto es la TERCERA cuota, no la primera', () => {
    const agosto = interesCobradoDelPrestamo({
      prestamo: frances, cuotas: frances.cuotasAmortizacion, pagos,
      desde: d('2026-08-01'), hasta: d('2026-08-31'),
    })
    expect(Math.round(agosto)).toBe(45_000)
  })

  it('si solo se pasaran los del mes, saldría de más', () => {
    /* Este es el error que la ventana evita: tratar el primer pago del mes como
       si fuera el primero del préstamo. */
    const soloAgosto = interesCobradoDelPrestamo({
      prestamo: frances, cuotas: frances.cuotasAmortizacion,
      pagos: [pagos[2]],
    })
    expect(Math.round(soloAgosto)).toBe(100_000)
    expect(Math.round(soloAgosto)).toBeGreaterThan(45_000)
  })

  it('los tres meses juntos suman lo que dice la tabla', () => {
    const todo = interesCobradoDelPrestamo({ prestamo: frances, cuotas: frances.cuotasAmortizacion, pagos })
    expect(Math.round(todo)).toBe(100_000 + 70_000 + 45_000)
  })
})

describe('⚠ el dashboard usa la pieza compartida, no una cuenta propia', () => {
  const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '')
  const src = leer('app/api/dashboard/resumen/route.js')

  it('llama a interesCobradoDeLosPrestamos', () => {
    expect(src).toMatch(/interesCobradoDeLosPrestamos\(/)
  })

  it('ya no reparte a mano por la fracción', () => {
    expect(src, 'volvió el reparto por proporción escrito a mano')
      .not.toMatch(/monto \* fraccionInteres\(pago\.prestamo\)/)
  })

  it('trae la tabla y el historial en el select', () => {
    // Sin las cuotas la corrección no puede aplicarse y nadie da un error.
    expect(src).toMatch(/select: SELECT_PARA_INTERES/)
  })
})

describe('la suma de varios préstamos', () => {
  it('junta los que tienen tabla y los que no', () => {
    const total = interesCobradoDeLosPrestamos([
      { ...frances, pagos: [{ montoPagado: 250_000, fechaPago: d('2026-08-05') }] },
      {
        montoPrestado: 100_000, totalAPagar: 120_000, modoInteres: 'fijo',
        cuotasAmortizacion: [],
        pagos: [{ montoPagado: 60_000, fechaPago: d('2026-08-06') }],
      },
    ], { desde: d('2026-08-01'), hasta: d('2026-08-31') })
    expect(total).toBe(110_000)   // 100.000 del francés + 10.000 del fijo
  })

  it('una lista vacía da cero, no NaN', () => {
    expect(interesCobradoDeLosPrestamos([], { desde: d('2026-08-01') })).toBe(0)
    expect(interesCobradoDeLosPrestamos()).toBe(0)
  })
})
