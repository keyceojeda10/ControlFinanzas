// lib/__tests__/importar-cartera-transaccion.test.js
//
// I3. El `$transaction` por cliente de `importarCartera` no llevaba `timeout`:
// en producción se queda en los 5 s de Prisma, y `registrarMovimientoCapital`
// bloquea `Capital` FOR UPDATE compitiendo con los cobros de la calle. Necesita
// al menos 15 s, como los otros sitios que ya usan PRISMA_TX_TIMEOUT_MS.
//
// I4. Los contadores (`clientesCreados`, `prestamosCreados`, `pagosRegistrados`,
// `montoDesembolsado`, `prestamosRepetidos`) se incrementaban DENTRO del
// callback de la transacción. Si la transacción de un cliente fallaba al
// confirmar (el callback ya corrió, pero el commit no), las mutaciones a las
// variables de fuera ya habían pasado: en el espejo el Historial decía 46 y la
// base tenía 19. Hay que contar en variables locales a cada iteración y sumarlas
// a los totales solo DESPUÉS de que `await prisma.$transaction(...)` resuelva.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('I3: la transacción de importarCartera lleva timeout', () => {
  it('$transaction(... , { timeout: Math.max(Number(PRISMA_TX_TIMEOUT_MS) || 0, 15000) })', () => {
    const cartera = src('lib/importar-cartera.js')
    expect(cartera).toMatch(/timeout: Math\.max\(Number\(process\.env\.PRISMA_TX_TIMEOUT_MS\) \|\| 0, 15000\)/)
  })
})

// ── I4: mock mínimo de prisma para importarCartera ──────────────────────────
const estado = vi.hoisted(() => ({
  llamadasTransaction: 0,
  // La transacción del PRIMER cliente procesado corre su callback entero
  // (crea cliente, préstamo, abono…) pero el COMMIT falla después — así se
  // reproduce el caso real: el callback sí corrió, la base no se quedó con nada.
  fallaEnLlamada: 1,
}))

const txMock = vi.hoisted(() => ({
  cliente: {
    create: vi.fn(async ({ data }) => ({ id: `nuevo-${data.cedula}` })),
    update: vi.fn(async () => ({})),
    findUnique: vi.fn(async () => ({ diasSinCobro: null })),
  },
  prestamo: {
    create: vi.fn(async ({ data }) => ({ id: `prestamo-${data.clienteId}-${data.montoPrestado}` })),
    findMany: vi.fn(async () => []),
  },
  pago: {
    create: vi.fn(async () => ({})),
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    cliente: {
      count: vi.fn(async () => 0),
      findMany: vi.fn(async () => []), // ningún cliente existente: los dos son nuevos
    },
    prestamo: {
      findMany: vi.fn(async () => []), // sin préstamos previos: sin huellas que repitan
    },
    organization: {
      findUnique: vi.fn(async () => ({ plan: 'starter', clientesExtra: 0, diasSinCobro: null, rutasExtra: 0 })),
    },
    $transaction: vi.fn(async (cb) => {
      estado.llamadasTransaction++
      const soyElQueFalla = estado.llamadasTransaction === estado.fallaEnLlamada
      const resultado = await cb(txMock)
      if (soyElQueFalla) throw new Error('Lock wait timeout exceeded (simulado)')
      return resultado
    }),
  },
}))
vi.mock('@/lib/capital', () => ({ registrarMovimientoCapital: vi.fn(async () => {}) }))
vi.mock('@/lib/prisma-pago-helpers', () => ({ refrescarTotalesPrestamo: vi.fn(async () => {}) }))

const { importarCartera } = await import('@/lib/importar-cartera')

beforeEach(() => {
  estado.llamadasTransaction = 0
  estado.fallaEnLlamada = 1
})

const filaImportar = ({ cedula, nombre, monto, abonado }) => ({
  datos: {
    nombre, cedula, telefono: null, direccion: null, referencia: null,
    tipo: 'prestamo', montoPrestado: monto, tasaInteres: 20, diasPlazo: 40, valorCuota: 0,
    frecuencia: 'diario', fechaInicio: '2026-01-01', abonadoHasta: abonado, tienePrestamo: true,
  },
})

describe('I4: los contadores solo cuentan lo que de verdad se confirmó', () => {
  it('un cliente cuya transacción falla al confirmar no se cuenta; el que sí confirma, sí', async () => {
    const filaFalla = filaImportar({ cedula: 'CED-FALLA', nombre: 'Cliente que falla', monto: 500000, abonado: 50000 })
    const filaOk = filaImportar({ cedula: 'CED-OK', nombre: 'Cliente que confirma', monto: 1000000, abonado: 100000 })

    const { resultado } = await importarCartera({
      organizationId: 'org1', plan: 'starter', usuarioId: 'u1',
      filas: [filaFalla, filaOk],
    })

    // Las dos transacciones corrieron su callback (por eso hay 2 llamadas),
    // pero solo UNA confirmó.
    expect(estado.llamadasTransaction).toBe(2)
    expect(resultado.clientesCreados).toBe(1)
    expect(resultado.prestamosCreados).toBe(1)
    expect(resultado.pagosRegistrados).toBe(1)
    expect(resultado.montoDesembolsado).toBe(1000000)
    expect(resultado.errores).toHaveLength(1)
    expect(resultado.errores[0].cedula).toBe('CED-FALLA')
  })

  it('si en cambio falla el SEGUNDO, el primero sí queda contado', async () => {
    estado.fallaEnLlamada = 2
    const filaOk = filaImportar({ cedula: 'CED-OK-2', nombre: 'Cliente que confirma', monto: 700000, abonado: 0 })
    const filaFalla = filaImportar({ cedula: 'CED-FALLA-2', nombre: 'Cliente que falla', monto: 300000, abonado: 0 })

    const { resultado } = await importarCartera({
      organizationId: 'org1', plan: 'starter', usuarioId: 'u1',
      filas: [filaOk, filaFalla],
    })

    expect(resultado.clientesCreados).toBe(1)
    expect(resultado.prestamosCreados).toBe(1)
    expect(resultado.montoDesembolsado).toBe(700000)
  })
})
