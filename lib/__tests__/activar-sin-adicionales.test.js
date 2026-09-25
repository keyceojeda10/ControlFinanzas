// lib/__tests__/activar-sin-adicionales.test.js
//
// ⚠ Pagar un plan que no admite adicionales los pone en cero. Si no, bajar de
// Crecimiento a Básico los dejaba en la columna y volver a Crecimiento meses
// después los traía al cobro sin que nadie los pidiera.

import { describe, it, expect, vi, beforeEach } from 'vitest'

let orgData
vi.mock('@/lib/email', () => ({ enviarEmail: vi.fn(async () => {}), emailPagoAprobado: () => ({}), emailReferidoExitoso: () => ({}) }))
vi.mock('@/lib/admin-log', () => ({ registrarAdminLog: vi.fn(async () => {}) }))
vi.mock('@/lib/libro-pagos', () => ({ registrarPagoSuscripcion: vi.fn(async () => ({})) }))
vi.mock('@/lib/prisma', () => {
  const tx = {
    suscripcion: {
      findFirst: vi.fn(async ({ where }) => (where.wompiTransactionId ? null : { id: 's1', estado: 'activa', fechaVencimiento: new Date(Date.now() + 86400000) })),
      updateMany: vi.fn(async () => ({ count: 0 })),
      update: vi.fn(async ({ data }) => ({ id: 's1', ...data })),
      create: vi.fn(async ({ data }) => ({ id: 's2', ...data })),
    },
    organization: { update: vi.fn(async ({ data }) => { orgData = data; return data }) },
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

beforeEach(() => { orgData = null })

describe('activar un plan y los adicionales', () => {
  it('Básico pagado: los adicionales quedan en cero', async () => {
    await activarPlanPagado({ organizationId: 'o1', plan: 'basic', montoCOP: 59000, gateway: 'wompi', gatewayId: 't1' })
    expect(orgData).toMatchObject({ plan: 'basic', cobradoresAdicionales: 0, rutasAdicionales: 0 })
  })

  it('Crecimiento pagado: los adicionales no se tocan', async () => {
    await activarPlanPagado({ organizationId: 'o1', plan: 'growth', montoCOP: 98000, gateway: 'wompi', gatewayId: 't2' })
    expect(orgData.plan).toBe('growth')
    expect(orgData).not.toHaveProperty('cobradoresAdicionales')
    expect(orgData).not.toHaveProperty('rutasAdicionales')
  })
})
