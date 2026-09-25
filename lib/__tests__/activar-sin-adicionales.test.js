// lib/__tests__/activar-sin-adicionales.test.js
//
// ⚠ Pagar un plan que no admite adicionales los pone en cero. Si no, bajar de
// Crecimiento a Básico los dejaba en la columna y volver a Crecimiento meses
// después los traía al cobro sin que nadie los pidiera.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let orgData
let subData
let actuales = { cobradoresAdicionales: 3, rutasAdicionales: 0 }
vi.mock('@/lib/email', () => ({ enviarEmail: vi.fn(async () => {}), emailPagoAprobado: () => ({}), emailReferidoExitoso: () => ({}) }))
vi.mock('@/lib/admin-log', () => ({ registrarAdminLog: vi.fn(async () => {}) }))
vi.mock('@/lib/libro-pagos', () => ({ registrarPagoSuscripcion: vi.fn(async () => ({})) }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    suscripcion: {
      findFirst: vi.fn(async ({ where }) => (where.wompiTransactionId ? null : { id: 's1', estado: 'activa', fechaVencimiento: new Date(Date.now() + 86400000) })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(async ({ data }) => { subData = data; return { id: 's1', ...data } }),
      create: vi.fn(async ({ data }) => { subData = data; return { id: 's2', ...data } }),
    },
    organization: {
      update: vi.fn(async ({ data }) => { orgData = data; return data }),
      findUnique: vi.fn(async () => ({ ...actuales })),
    },
  }
  return {
    prisma: {
      $transaction: vi.fn(async (fn) => fn(tx)),
      organization: { findUnique: vi.fn(async () => ({ referidoPorId: null, nombre: 'N' })) },
      user: { findFirst: vi.fn(async () => null) },
      suscripcion: { count: vi.fn(async () => 2) },
    },
  }
})

const { activarPlanPagado } = await import('@/lib/activar-suscripcion')

beforeEach(() => { orgData = null; subData = null; actuales = { cobradoresAdicionales: 3, rutasAdicionales: 0 } })

describe('activar un plan y los adicionales', () => {
  it('Básico pagado: los adicionales quedan en cero', async () => {
    await activarPlanPagado({ organizationId: 'o1', plan: 'basic', montoCOP: 59000, gateway: 'wompi', gatewayId: 't1' })
    expect(orgData).toMatchObject({ plan: 'basic', cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })

  it('⚠ un pago que cobró 1 cobrador deja 1 aunque en la columna haya 3 (subidos después del checkout)', async () => {
    await activarPlanPagado({ organizationId: 'o1', plan: 'growth', montoCOP: 98000, gateway: 'wompi', gatewayId: 't3', conAdicionales: { cobradores: 1, rutas: 0 } })
    expect(orgData).toMatchObject({ plan: 'growth', cobradoresAdicionales: 1, rutasAdicionales: 0 })
    expect(subData.montoAdicionales).toBe(19000)
  })

  it('nunca SUBE: si pagó por 3 y ya quitó uno, quedan 2', async () => {
    actuales = { cobradoresAdicionales: 2, rutasAdicionales: 0 }
    await activarPlanPagado({ organizationId: 'o1', plan: 'growth', periodo: 'trimestral', montoCOP: 213300 + 3 * 19000 * 3, gateway: 'wompi', gatewayId: 't4', conAdicionales: { cobradores: 3, rutas: 0 } })
    expect(orgData.cobradoresAdicionales).toBe(2)
    expect(subData.montoAdicionales).toBe(3 * 19000 * 3)
  })

  it('⚠ el cobro AUTOMÁTICO no recorta: uno comprado aparte en vuelo se queda', async () => {
    actuales = { cobradoresAdicionales: 3, rutasAdicionales: 0 }
    await activarPlanPagado({ organizationId: 'o1', plan: 'growth', montoCOP: 117000, gateway: 'wompi', gatewayId: 't5', conAdicionales: { cobradores: 2, rutas: 0, automatico: true } })
    expect(orgData).not.toHaveProperty('cobradoresAdicionales')
    expect(subData.montoAdicionales).toBe(38000)
  })

  it('Crecimiento pagado: los adicionales no se tocan', async () => {
    await activarPlanPagado({ organizationId: 'o1', plan: 'growth', montoCOP: 98000, gateway: 'wompi', gatewayId: 't2' })
    expect(orgData.plan).toBe('growth')
    expect(orgData).not.toHaveProperty('cobradoresAdicionales')
    expect(orgData).not.toHaveProperty('rutasAdicionales')
  })
})
