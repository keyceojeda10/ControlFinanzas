import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'

// 5 nov 2026: 7 negocios aprobaron su Nequi y nunca quedó guardado, porque solo
// lo guardaba la pantalla mientras estuviera abierta (3 minutos).

const org = { nequiTokenPendiente: 'nequi_prod_T1', nequiPlanElegido: 'standard', wompiFuentePagoId: null, wompiFuenteTipo: null }
const db = {
  organization: {
    findUnique: vi.fn(async () => ({ ...org })),
    update: vi.fn(async () => ({})),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
  user: { findFirst: vi.fn(async () => ({ email: 'dueno@x.co' })) },
}
const wompi = { estado: 'APPROVED' }
vi.mock('@/lib/prisma', () => ({ prisma: db }))
vi.mock('@/lib/wompi', () => ({
  estadoTokenNequi: vi.fn(async () => wompi.estado),
  crearFuenteDePago: vi.fn(async () => ({ id: 777, publico: { phone_number: '3001230692' } })),
}))
vi.mock('@/lib/cobro-intento', () => ({ cobrarAhoraSiToca: vi.fn(async () => ({ resultado: 'enviado' })) }))
vi.mock('@/lib/cobro-automatico', () => ({ motivoLegible: (m) => m }))
vi.mock('@/lib/seguimiento/oferta-nequi', () => ({ aplicarOfertaNequi: vi.fn(async () => ({ aplicada: true })) }))

const { confirmarNequi } = await import('@/lib/pagos/confirmar-nequi')
const { crearFuenteDePago } = await import('@/lib/wompi')
const { cobrarAhoraSiToca } = await import('@/lib/cobro-intento')
const { aplicarOfertaNequi } = await import('@/lib/seguimiento/oferta-nequi')

beforeEach(() => { vi.clearAllMocks(); wompi.estado = 'APPROVED'; db.organization.updateMany.mockResolvedValue({ count: 1 }) })

describe('el servidor confirma la autorización aunque la pantalla esté cerrada', () => {
  it('mientras Nequi diga PENDING, no guarda nada', async () => {
    wompi.estado = 'PENDING'
    expect(await confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron' })).toEqual({ estado: 'PENDING', guardado: false })
    expect(crearFuenteDePago).not.toHaveBeenCalled()
  })
  it('aprobado: guarda el Nequi, aplica la oferta y cobra el plan que eligió', async () => {
    const r = await confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron' })
    expect(r).toMatchObject({ guardado: true, rotulo: 'Nequi ···0692' })
    expect(db.organization.update.mock.calls[0][0].data).toMatchObject({ wompiFuentePagoId: 777, wompiFuenteTipo: 'NEQUI', nequiTokenPendiente: null })
    expect(aplicarOfertaNequi).toHaveBeenCalledWith('o', { planElegido: 'standard' })
    expect(cobrarAhoraSiToca).toHaveBeenCalledWith({ orgId: 'o', planElegido: 'standard', origen: 'confirmar-nequi-cron' })
  })
  it('⚠ si la otra vía ya lo está guardando, no crea una segunda fuente ni cobra', async () => {
    db.organization.updateMany.mockResolvedValueOnce({ count: 0 })
    db.organization.findUnique.mockResolvedValueOnce({ ...org, nequiTokenPendiente: 'guardando:nequi_prod_T1' })
    expect(await confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron' })).toMatchObject({ guardado: true })
    expect(crearFuenteDePago).not.toHaveBeenCalled()
    expect(cobrarAhoraSiToca).not.toHaveBeenCalled()
  })
  it('si Wompi rechaza crear la fuente, el pedido vuelve para el próximo intento', async () => {
    crearFuenteDePago.mockRejectedValueOnce(new Error('token vencido'))
    await expect(confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron' })).rejects.toThrow('token vencido')
    expect(db.organization.updateMany.mock.calls.at(-1)[0]).toMatchObject({ data: { nequiTokenPendiente: 'nequi_prod_T1' } })
  })
  it('`cobrar: false` guarda y aplica la oferta, pero el cobro queda para su fecha', async () => {
    const r = await confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron', cobrar: false })
    expect(r).toMatchObject({ guardado: true, cobro: { resultado: 'en_su_fecha' } })
    expect(aplicarOfertaNequi).toHaveBeenCalled()
    expect(cobrarAhoraSiToca).not.toHaveBeenCalled()
  })
  it('dijo que no: el pedido se olvida', async () => {
    wompi.estado = 'DECLINED'
    await confirmarNequi({ organizationId: 'o', tokenId: 'nequi_prod_T1', origen: 'confirmar-nequi-cron' })
    expect(db.organization.updateMany.mock.calls[0][0].data).toEqual({ nequiTokenPendiente: null, nequiTokenPedidoAt: null, nequiPlanElegido: null })
  })
})

describe('el pedido se apunta y lo confirman la pantalla y el cron', () => {
  const leer = (f) => readFileSync(f, 'utf8')
  it('la ruta apunta el pedido y usa la misma función', () => {
    const src = leer('app/api/pagos/wompi/nequi/route.js')
    expect(src).toMatch(/await apuntarPedidoNequi\(session\.user\.organizationId, \{ tokenId: t\.id/)
    expect(src).toMatch(/const r = await confirmarNequi\(\{/)
  })
  it('el cron recorre los pendientes', () => {
    expect(leer('app/api/cron/confirmar-nequi/route.js')).toMatch(/origen: 'confirmar-nequi-cron'/)
  })
  it('la pantalla manda el plan y ya no dice «vuelve a intentarlo» al pasar los 3 minutos', () => {
    const src = leer('components/pagos/HojaSuscripcion.jsx')
    expect(src).toMatch(/body: JSON\.stringify\(\{ telefono: digitos, plan \}\)/)
    expect(src).not.toMatch(/Se pasó el tiempo de espera/)
  })
})
