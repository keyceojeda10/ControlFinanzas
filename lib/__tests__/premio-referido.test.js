// El premio de referido: solo el PRIMER pago, decidido por el libro (22 nov 2026).
// Antes contaba filas de `Suscripcion` (una que cada pago pisa) y quien refería
// a alguien con cobro automático ganaba un mes gratis cada mes.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'fs'

let estado
const logs = []
vi.mock('@/lib/email', () => ({ enviarEmail: vi.fn(async () => {}), emailReferidoExitoso: () => ({ subject: 's', html: 'h' }) }))
vi.mock('@/lib/admin-log', () => ({ registrarAdminLog: vi.fn(async (l) => { logs.push(l) }) }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    organization: { findUnique: vi.fn(async () => ({ referidoPorId: estado.referidor, nombre: 'Referido SAS' })) },
    pagoSuscripcion: { count: vi.fn(async () => estado.pagosEnLibro) },
    adminLog: {
      count: vi.fn(async () => estado.pagosEnLog),
      findFirst: vi.fn(async () => (estado.yaPremiado ? { id: 'l1' } : null)),
    },
    suscripcion: {
      findFirst: vi.fn(async () => estado.sub),
      update: vi.fn(async ({ data }) => { estado.actualizada = data; return data }),
    },
    user: { findFirst: vi.fn(async () => null) },
  },
}))

const { darPremioReferido, esPrimerPago } = await import('@/lib/premio-referido')
const AHORA = new Date('2026-11-22T15:00:00Z')

beforeEach(() => {
  logs.length = 0
  estado = {
    referidor: 'ref1', pagosEnLibro: 1, pagosEnLog: 0, yaPremiado: false, actualizada: null,
    sub: { id: 's1', estado: 'activa', fechaVencimiento: new Date('2026-12-09T18:00:00Z') },
  }
})

describe('premio de referido', () => {
  it('primer pago: +30 días desde el vencimiento del referidor, y queda escrito', async () => {
    const r = await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })
    expect(r.premio).toBe(true)
    expect(estado.actualizada.fechaVencimiento.toISOString()).toBe('2027-01-08T18:00:00.000Z')
    expect(logs).toHaveLength(1)
    expect(logs[0]).toMatchObject({ organizacionId: 'ref1', accion: 'premio_referido' })
    // La llave va al principio: el AdminLog recorta a 191.
    expect(logs[0].detalle.startsWith('Referido org-referido:')).toBe(true)
  })

  it('⚠ el SEGUNDO pago no da nada (el caso 5jleg3: un mes gratis cada mes)', async () => {
    estado.pagosEnLibro = 2
    const r = await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })
    expect(r).toMatchObject({ premio: false, motivo: 'no_es_el_primer_pago' })
    expect(estado.actualizada).toBeNull()
    expect(logs).toHaveLength(0)
  })

  it('un pago anterior al libro (solo en el AdminLog) también cuenta', async () => {
    estado.pagosEnLog = 1
    expect((await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })).premio).toBe(false)
  })

  it('ya premiado por este referido: no se repite', async () => {
    estado.yaPremiado = true
    expect((await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })).premio).toBe(false)
  })

  it('una cortesía de $0 no es un pago: no hay premio', async () => {
    estado.pagosEnLibro = 0
    expect((await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })).premio).toBe(false)
  })

  it('referidor vencido: cuenta desde hoy y revive', async () => {
    estado.sub = { id: 's1', estado: 'vencida', fechaVencimiento: new Date('2026-11-01T18:00:00Z') }
    await darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })
    expect(estado.actualizada.fechaVencimiento.toISOString()).toBe('2026-12-22T15:00:00.000Z')
    expect(estado.actualizada.estado).toBe('activa')
  })

  it('sin referidor no hace nada', async () => {
    estado.referidor = null
    expect((await darPremioReferido({ organizationId: 'o', ahora: AHORA })).motivo).toBe('sin_referidor')
  })

  it('si falla no tira: el pago ya está activado', async () => {
    estado.sub = { get fechaVencimiento() { throw new Error('boom') }, estado: 'activa' }
    await expect(darPremioReferido({ organizationId: 'org-referido', ahora: AHORA })).resolves.toMatchObject({ premio: false, motivo: 'error' })
  })

  it('esPrimerPago', () => {
    expect(esPrimerPago({ pagosEnLibro: 1, pagosEnLog: 0, yaPremiado: false })).toBe(true)
    expect(esPrimerPago({ pagosEnLibro: 1, pagosEnLog: 0, yaPremiado: true })).toBe(false)
  })
})

describe('las dos vías usan la misma función', () => {
  for (const f of ['lib/activar-suscripcion.js', 'app/api/admin/organizaciones/[id]/route.js']) {
    it(`${f} llama a darPremioReferido y ya no cuenta filas de Suscripcion`, () => {
      const src = readFileSync(f, 'utf8')
      expect(src).toMatch(/await darPremioReferido\(\{ organizationId/)
      expect(src).not.toMatch(/nuevaFechaRef/)
      expect(src).not.toMatch(/prisma\.suscripcion\.count\(/)
    })
  }
})
