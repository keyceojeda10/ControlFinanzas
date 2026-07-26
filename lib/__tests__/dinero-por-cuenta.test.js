import { describe, it, expect } from 'vitest'
import { getSaldosPorCuenta } from '../capital'
import { cuotaProximoCobro } from '../calculos'

// Mock minimo de prisma: metodoPago.findMany + movimientoCapital.groupBy.
function mockPrisma({ metodos = [], movimientos = [] }) {
  return {
    metodoPago: {
      findMany: async () => metodos,
    },
    movimientoCapital: {
      groupBy: async () => movimientos.map((m) => ({
        metodoPago: m.metodoPago ?? null,
        metodoPagoId: m.metodoPagoId ?? null,
        tipo: m.tipo,
        _sum: { monto: m.monto },
      })),
    },
  }
}

describe('getSaldosPorCuenta', () => {
  it('separa efectivo y cuentas de transferencia con entro/salio/neto', async () => {
    const prisma = mockPrisma({
      metodos: [{ id: 'nequi', nombre: 'Nequi', activo: true, orden: 0 }],
      movimientos: [
        { metodoPago: 'efectivo', tipo: 'recaudo', monto: 500000 },
        { metodoPago: 'efectivo', tipo: 'desembolso', monto: 300000 },
        { metodoPago: 'transferencia', metodoPagoId: 'nequi', tipo: 'recaudo', monto: 200000 },
      ],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    const efectivo = cuentas.find((c) => c.key === 'efectivo')
    const nequi = cuentas.find((c) => c.key === 'nequi')

    expect(efectivo.entradas).toBe(500000)
    expect(efectivo.salidas).toBe(300000)
    expect(efectivo.neto).toBe(200000)
    expect(efectivo.recaudado).toBe(500000)
    expect(efectivo.prestado).toBe(300000)

    expect(nequi.entradas).toBe(200000)
    expect(nequi.salidas).toBe(0)
    expect(nequi.neto).toBe(200000)
  })

  it('agrupa movimientos sin cuenta (historico) en sin_registrar', async () => {
    const prisma = mockPrisma({
      metodos: [],
      movimientos: [
        { metodoPago: null, tipo: 'recaudo', monto: 100000 },
        { metodoPago: null, tipo: 'desembolso', monto: 40000 },
      ],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    const sin = cuentas.find((c) => c.tipoCuenta === 'sin_registrar')
    expect(sin).toBeTruthy()
    expect(sin.entradas).toBe(100000)
    expect(sin.salidas).toBe(40000)
    expect(sin.neto).toBe(60000)
  })

  it('transferencia sin cuenta especifica cae en bucket "transferencia"', async () => {
    const prisma = mockPrisma({
      metodos: [],
      movimientos: [
        { metodoPago: 'transferencia', metodoPagoId: null, tipo: 'recaudo', monto: 75000 },
      ],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    const transfer = cuentas.find((c) => c.key === 'transferencia')
    expect(transfer.entradas).toBe(75000)
  })

  it('inyeccion y retiro cuentan como entrada y salida', async () => {
    const prisma = mockPrisma({
      metodos: [],
      movimientos: [
        { metodoPago: 'efectivo', tipo: 'inyeccion', monto: 1000000 },
        { metodoPago: 'efectivo', tipo: 'retiro', monto: 250000 },
      ],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    const efectivo = cuentas.find((c) => c.key === 'efectivo')
    expect(efectivo.entradas).toBe(1000000)
    expect(efectivo.salidas).toBe(250000)
    expect(efectivo.inyectado).toBe(1000000)
    expect(efectivo.retirado).toBe(250000)
    expect(efectivo.neto).toBe(750000)
  })
})

describe('cuotaProximoCobro (modo fijo / no-tabla)', () => {
  const fijo = { modoInteres: 'fijo', cuotaDiaria: 100000 }
  it('devuelve la cuota cuando el saldo la cubre', () => {
    expect(cuotaProximoCobro({ ...fijo, saldoPendiente: 350000 })).toBe(100000)
  })
  it('topa a saldo cuando es la ultima cuota menor', () => {
    expect(cuotaProximoCobro({ ...fijo, saldoPendiente: 40000 })).toBe(40000)
  })
  it('0 si saldo 0', () => {
    expect(cuotaProximoCobro({ ...fijo, saldoPendiente: 0 })).toBe(0)
  })
})
