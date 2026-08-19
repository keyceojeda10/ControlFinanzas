// lib/__tests__/abierto-devenga-al-crear.test.js
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// «Debería salir en mora los intereses que se deben, y debajo de Yeison
//  AGUDELO en mora y no al día, porque aún no ha pagado los intereses.»
//   — Rhoders (FACIL), 19 ago 2026, con la captura tomada un minuto después de
//   crear el préstamo.
//
// Tenía razón. Prestó $690.000 al 10% mensual con fecha de inicio del 1 de
// julio: el período que cerró el 1 de agosto ya se debía, $69.000. La ficha
// decía «Al día · atraso $0».
//
// ⚠ Y NO ERA EL CRON. El cron funciona: corrió ese mismo día a las 00:05 y no
//   había nada que asentar, porque **el préstamo se creó diez horas después**
//   (15:23 UTC). Un abierto con fecha retroactiva enseñaba una deuda que no era
//   hasta el amanecer siguiente.
//
// Lo que estas pruebas cuidan:
//
//   1. Que crear un abierto con fecha hacia atrás vuelva a dejar los períodos
//      cerrados sin asentar.
//   2. Que el asiento se duplique. Ahora hay DOS disparadores —el cron y la
//      creación— y devengar dos veces es lo que mató a la línea de crédito.
//   3. Que el cron deje de usar la misma función y las dos cuentas se separen.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { devengarPrestamoAbierto } from '@/lib/dinero/devengar'

const leer = (r) => readFileSync(resolve(process.cwd(), r), 'utf8')
const dia = (s) => new Date(`${s}T05:00:00.000Z`)
const HOY = Date.parse('2026-08-19T15:23:00.000Z') // cuando Rhoders lo creó

/** El préstamo de Yeison Agudelo, tal como lo creó. */
const yeison = (extra = {}) => ({
  id: 'p1',
  organizationId: 'org1',
  estado: 'activo',
  montoPrestado: 690_000,
  totalAPagar: 690_000,
  tasaInteres: 10,
  frecuencia: 'mensual',
  modoInteres: 'solo_interes',
  sinPlazo: true,
  fechaInicio: dia('2026-07-01'),
  diaCobroMes: null,
  diaCobroMes2: null,
  primerCobro: null,
  pagos: [],
  devengos: [],
  cuotasAmortizacion: [],
  ...extra,
})

/** Un Prisma de mentira: apunta lo que se le pide. */
function prismaFalso({ chocar = false } = {}) {
  const creados = []
  const subidas = []
  return {
    creados, subidas,
    $transaction: async (fn) => fn({
      devengoInteres: {
        create: async (args) => {
          if (chocar) { const e = new Error('unique'); e.code = 'P2002'; throw e }
          creados.push(args.data)
          return args.data
        },
      },
      prestamo: { update: async (args) => { subidas.push(args.data.totalAPagar.increment); return args } },
    }),
  }
}

describe('⚠ el abierto con fecha hacia atrás devenga al crearse', () => {
  it('asienta el período que cerró el 1 de agosto: $69.000', async () => {
    const prisma = prismaFalso()
    const r = await devengarPrestamoAbierto(prisma, yeison(), HOY)

    expect(r.asentados).toBe(1)
    expect(r.interes).toBe(69_000)
    expect(prisma.creados[0]).toMatchObject({
      prestamoId: 'p1', periodo: '2026-08-01', capitalBase: 690_000, interes: 69_000,
    })
  })

  it('la deuda sube por el mismo importe, en la misma transacción', async () => {
    const prisma = prismaFalso()
    await devengarPrestamoAbierto(prisma, yeison(), HOY)
    expect(prisma.subidas).toEqual([69_000])
  })

  it('⚠ lo ya asentado no se vuelve a asentar', async () => {
    const prisma = prismaFalso()
    const r = await devengarPrestamoAbierto(prisma, yeison({ devengos: [{ periodo: '2026-08-01' }] }), HOY)
    expect(r.asentados).toBe(0)
    expect(prisma.creados).toHaveLength(0)
  })

  it('⚠ y si el cron se cruza, la clave única manda y no revienta', async () => {
    /* Es la única defensa que no depende de que el código esté bien, y ahora
       hace más falta: hay dos disparadores en vez de uno. */
    const prisma = prismaFalso({ chocar: true })
    const r = await devengarPrestamoAbierto(prisma, yeison(), HOY)
    expect(r.choques).toBe(1)
    expect(r.asentados).toBe(0)
    expect(prisma.subidas).toHaveLength(0)
  })

  it('un préstamo del mismo día no devenga nada', async () => {
    const prisma = prismaFalso()
    const r = await devengarPrestamoAbierto(prisma, yeison({ fechaInicio: dia('2026-08-18') }), HOY)
    expect(r.asentados).toBe(0)
  })

  it('los que no son abiertos no se tocan', async () => {
    const prisma = prismaFalso()
    for (const p of [yeison({ sinPlazo: false }), yeison({ modoInteres: 'fijo' }), yeison({ estado: 'cancelado' })]) {
      expect((await devengarPrestamoAbierto(prisma, p, HOY)).asentados).toBe(0)
    }
    expect(prisma.creados).toHaveLength(0)
  })
})

describe('⚠ los dos disparadores usan la MISMA cuenta', () => {
  it('el cron no tiene su propia copia del asiento', () => {
    const src = leer('app/api/cron/devengo-abiertos/route.js')
    expect(src).toMatch(/devengarPrestamoAbierto\(prisma, p, ahora\)/)
    expect(src, 'el cron volvió a escribir el asiento por su cuenta')
      .not.toMatch(/devengoInteres\.create/)
  })

  it('la creación del préstamo lo dispara', () => {
    const src = leer('app/api/prestamos/route.js')
    expect(src).toMatch(/devengarAlCrear\(prisma, prestamo\.id\)/)
    // No para los que están esperando aprobación: todavía no son un préstamo.
    expect(src).toMatch(/esAbierto && !esPendiente/)
  })
})
