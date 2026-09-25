// lib/__tests__/webhook-adicionales.test.js
//
// ⚠ UNA COMPRA DE ADICIONALES QUE LLEGA AL WEBHOOK NO ES UN PAGO DEL PLAN.
// Pasada a `activarPlanPagado`, le alargaría el plan 30 días por el precio de
// un cobrador. Se ejecuta el webhook de verdad, con Wompi y la base de mentira.

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('next/server', () => ({
  NextResponse: { json: (body, init) => ({ body, status: init?.status ?? 200 }) },
}))
vi.mock('@/lib/rate-limit', () => ({ webhookLimiter: () => ({ ok: true }), getClientIp: () => '1.1.1.1' }))
vi.mock('@/lib/alertas-pago', () => ({ alertarPagoSinActivar: vi.fn(), alertarPagoRevertido: vi.fn() }))
vi.mock('@/lib/cobro-intento', () => ({ contarRechazo: vi.fn(async () => false), ESTADOS_RECHAZO: new Set(['DECLINED', 'ERROR', 'VOIDED']) }))
vi.mock('@/lib/activar-suscripcion', () => ({ activarPlanPagado: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/adicionales', () => ({ aplicarCompraAdicionales: vi.fn(async () => ({ ok: true })) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { updateMany: vi.fn(async () => ({ count: 0 })), findUnique: vi.fn(async () => ({ nombre: 'Negocio' })) },
    suscripcion: { findUnique: vi.fn(async () => null) },
    pagoSuscripcion: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/wompi', async (importOriginal) => ({
  ...(await importOriginal()),
  validarFirmaEvento: () => true,
  consultarTransaccion: vi.fn(),
}))

const wompi = await import('@/lib/wompi')
const { activarPlanPagado } = await import('@/lib/activar-suscripcion')
const { aplicarCompraAdicionales } = await import('@/lib/adicionales')
const { alertarPagoRevertido } = await import('@/lib/alertas-pago')
const { prisma } = await import('@/lib/prisma')
const { POST } = await import('@/app/api/pagos/wompi/webhook/route')

const evento = (tx) => ({
  json: async () => ({ event: 'transaction.updated', data: { transaction: tx } }),
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('webhook de Wompi con una compra de adicionales', () => {
  it('APPROVED: suma los adicionales y NO toca el plan', async () => {
    const ref = wompi.referenciaDeAdicionales('org1', 'growth', { cobradores: 1, rutas: 2 })
    const tx = { id: 'tx-1', status: 'APPROVED', reference: ref, amount_in_cents: 6810000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    const r = await POST(evento(tx))
    expect(r.status).toBe(200)
    expect(activarPlanPagado).not.toHaveBeenCalled()
    expect(aplicarCompraAdicionales).toHaveBeenCalledWith(expect.objectContaining({
      organizationId: 'org1', plan: 'growth', adicionales: { cobradores: 1, rutas: 2 }, montoCOP: 68100, gatewayId: 'tx-1',
    }))
  })

  it('si sumar falla, contesta 500 para que Wompi reintente', async () => {
    const ref = wompi.referenciaDeAdicionales('org1', 'growth', { cobradores: 1, rutas: 0 })
    const tx = { id: 'tx-2', status: 'APPROVED', reference: ref, amount_in_cents: 1010000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    aplicarCompraAdicionales.mockRejectedValueOnce(new Error('base caída'))
    const r = await POST(evento(tx))
    expect(r.status).toBe(500)
    expect(activarPlanPagado).not.toHaveBeenCalled()
  })

  it('si lo pagado no alcanza, avisa y contesta 200 (reintentar no lo arregla)', async () => {
    const { alertarPagoSinActivar } = await import('@/lib/alertas-pago')
    const ref = wompi.referenciaDeAdicionales('org1', 'growth', { cobradores: 50, rutas: 50 })
    const tx = { id: 'tx-5', status: 'APPROVED', reference: ref, amount_in_cents: 150000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    aplicarCompraAdicionales.mockResolvedValueOnce({ ok: false, motivo: 'no alcanza' })
    const r = await POST(evento(tx))
    expect(r.status).toBe(200)
    expect(alertarPagoSinActivar).toHaveBeenCalledWith(expect.objectContaining({ transaccionId: 'tx-5', motivo: 'no alcanza' }))
    expect(activarPlanPagado).not.toHaveBeenCalled()
  })

  it('el pago del plan sigue por su camino, con cuántos adicionales se cobró', async () => {
    const ref = wompi.referenciaDeCobro('org1', 'growth', 'mensual', { cobradores: 1, rutas: 0 })
    const tx = { id: 'tx-3', status: 'APPROVED', reference: ref, amount_in_cents: 9800000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    await POST(evento(tx))
    expect(activarPlanPagado).toHaveBeenCalledWith(expect.objectContaining({
      plan: 'growth', periodo: 'mensual', montoCOP: 98000, conAdicionales: { cobradores: 1, rutas: 0 },
    }))
    expect(aplicarCompraAdicionales).not.toHaveBeenCalled()
  })

  it('una referencia vieja del plan (sin el dato) no manda cantidades', async () => {
    const tx = { id: 'tx-6', status: 'APPROVED', reference: 'cf-org1-growth-mensual-1727000000000', amount_in_cents: 7900000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    await POST(evento(tx))
    expect(activarPlanPagado).toHaveBeenCalledWith(expect.objectContaining({ periodo: 'mensual', conAdicionales: null }))
  })

  it('una compra de adicionales revertida avisa', async () => {
    const ref = wompi.referenciaDeAdicionales('org1', 'growth', { cobradores: 1, rutas: 0 })
    const tx = { id: 'tx-4', status: 'VOIDED', reference: ref, amount_in_cents: 1010000 }
    wompi.consultarTransaccion.mockResolvedValue(tx)
    prisma.pagoSuscripcion.findUnique.mockResolvedValueOnce({ periodo: 'adicionales', plan: 'growth', montoCOP: 10100, organizationId: 'org1' })
    await POST(evento(tx))
    expect(alertarPagoRevertido).toHaveBeenCalledTimes(1)
    expect(activarPlanPagado).not.toHaveBeenCalled()
  })
})
