import { describe, it, expect } from 'vitest'
import { getSaldosPorCuenta } from '../capital'
import { cuotaProximoCobro } from '../calculos'

// Mock minimo de prisma: metodoPago.findMany + movimientoCapital.groupBy
// + movimientoCapital.findMany (los ajustes, uno por uno). Guarda los `where`
// para poder comprobar qué se deja fuera.
function mockPrisma({ metodos = [], movimientos = [], ajustes = [] }) {
  const vistos = { groupBy: null, findMany: null }
  return {
    vistos,
    metodoPago: {
      findMany: async () => metodos,
    },
    movimientoCapital: {
      groupBy: async (args) => {
        // Pasar entre cuentas tiene su propia consulta (`noMueveCapital` a
        // propósito: no mueve el negocio, sí la cuenta); la mira su prueba.
        if (args?.where?.tipo === 'traslado') return []
        vistos.groupBy = args?.where
        return movimientos.map((m) => ({
          metodoPago: m.metodoPago ?? null,
          metodoPagoId: m.metodoPagoId ?? null,
          tipo: m.tipo,
          _sum: { monto: m.monto },
        }))
      },
      findMany: async (args) => {
        vistos.findMany = args?.where
        return ajustes
      },
    },
  }
}

// Un ajuste con su signo: el que baja el saldo tiene saldoNuevo < saldoAnterior.
const ajuste = (monto, extra = {}) => ({
  monto: Math.abs(monto),
  saldoAnterior: 1_000_000,
  saldoNuevo: 1_000_000 + monto,
  metodoPago: null, metodoPagoId: null, referenciaTipo: null,
  ...extra,
})

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

describe('los ajustes también son plata (DETALLES-CAJA #31)', () => {
  /* El negocio de la grabación: «Tienes en total» decía $302.000 más que el
     saldo. Eran tres cobros anulados en efectivo y el faltante de un cuadre. */
  it('el reverso de un cobro anulado en efectivo baja el efectivo', async () => {
    const prisma = mockPrisma({
      movimientos: [{ metodoPago: 'efectivo', tipo: 'recaudo', monto: 100000 }],
      ajustes: [ajuste(-100000, { metodoPago: 'efectivo', referenciaTipo: 'pago' })],
    })
    const efectivo = (await getSaldosPorCuenta(prisma, 'org1')).find((c) => c.key === 'efectivo')
    expect(efectivo.neto).toBe(0)
    expect(efectivo.ajustado).toBe(-100000)
  })

  it('el faltante de un cuadre es efectivo que no llegó', async () => {
    const prisma = mockPrisma({
      movimientos: [{ metodoPago: 'efectivo', tipo: 'recaudo', monto: 92000 }],
      ajustes: [ajuste(-5000, { referenciaTipo: 'cierre_cuadre' })],
    })
    const efectivo = (await getSaldosPorCuenta(prisma, 'org1')).find((c) => c.key === 'efectivo')
    expect(efectivo.neto).toBe(87000)
  })

  it('el reverso de un gasto rechazado vuelve al efectivo, de donde salió', async () => {
    const prisma = mockPrisma({
      movimientos: [{ metodoPago: 'efectivo', tipo: 'gasto', monto: 25000 }],
      ajustes: [ajuste(25000, { referenciaTipo: 'gasto' })],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    expect(cuentas.find((c) => c.key === 'efectivo').neto).toBe(0)
    expect(cuentas.some((c) => c.key === 'sin_cuenta')).toBe(false)
  })

  it('el reverso por transferencia baja su cuenta', async () => {
    const prisma = mockPrisma({
      metodos: [{ id: 'nequi', nombre: 'Nequi', activo: true, orden: 0 }],
      movimientos: [{ metodoPago: 'transferencia', metodoPagoId: 'nequi', tipo: 'recaudo', monto: 40000 }],
      ajustes: [ajuste(-40000, { metodoPago: 'transferencia', metodoPagoId: 'nequi', referenciaTipo: 'pago' })],
    })
    expect((await getSaldosPorCuenta(prisma, 'org1')).find((c) => c.key === 'nequi').neto).toBe(0)
  })

  it('lo que no pasa por ninguna cuenta va en su fila, con su nombre', async () => {
    const prisma = mockPrisma({
      movimientos: [{ metodoPago: 'efectivo', tipo: 'recaudo', monto: 50000 }],
      ajustes: [ajuste(300000, { referenciaTipo: 'prestamo_cancelado_devolver_todo' }), ajuste(-20000, { referenciaTipo: 'caja_ajuste' })],
    })
    const cuentas = await getSaldosPorCuenta(prisma, 'org1')
    const sinCuenta = cuentas.find((c) => c.key === 'sin_cuenta')
    expect(sinCuenta.nombre).toBe('Ajustes sin cuenta')
    expect(sinCuenta.neto).toBe(280000)
    expect(cuentas[cuentas.length - 1].key).toBe('sin_cuenta')
    // Sumado todo, es el saldo: 50.000 + 300.000 − 20.000.
    expect(cuentas.reduce((n, c) => n + c.neto, 0)).toBe(330000)
  })

  it('ni la reserva de una ruta ni lo que solo se apunta mueven ninguna cuenta', async () => {
    const prisma = mockPrisma({})
    await getSaldosPorCuenta(prisma, 'org1')
    for (const w of [prisma.vistos.groupBy, prisma.vistos.findMany]) {
      expect(w.ajusteArranqueRuta).toBe(false)
      expect(w.noMueveCapital).toBe(false)
    }
    expect(prisma.vistos.findMany.tipo).toBe('ajuste')
  })

  it('un ajuste de cero no crea filas', async () => {
    const prisma = mockPrisma({ ajustes: [ajuste(0)] })
    expect((await getSaldosPorCuenta(prisma, 'org1')).some((c) => c.key === 'sin_cuenta')).toBe(false)
  })
})
