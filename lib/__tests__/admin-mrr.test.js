import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mensualDe } from '@/lib/admin/mrr'
import { segmentarOrganizaciones } from '@/lib/admin/segmentos'

describe('el MRR es lo que entra por mes (2 nov 2026)', () => {
  it('un trimestral o un semestral se reparte en sus meses', () => {
    expect(mensualDe(39000, 'mensual')).toBe(39000)
    expect(mensualDe(105300, 'trimestral')).toBe(35100)
    expect(mensualDe(300000, 'semestral')).toBe(50000)
    expect(mensualDe(390000, 'anual')).toBe(32500)
    expect(mensualDe(59000)).toBe(59000) // sin periodo conocido, mensual
  })
  it('el panel suma al mes, no el último pago entero', () => {
    const ahora = new Date('2026-11-02T12:00:00Z')
    const org = (id, monto) => ({
      id, nombre: id, createdAt: '2026-06-01', _count: { clientes: 50, prestamos: 50 },
      users: [{ lastLoginAt: '2026-11-01' }],
      suscripciones: [{ estado: 'activa', montoCOP: monto, fechaVencimiento: '2026-12-30' }],
    })
    const { mrr } = segmentarOrganizaciones([org('a', 39000), org('b', 300000)], ahora, { periodos: new Map([['b', 'semestral']]) })
    expect(mrr).toBe(39000 + 50000)
  })
  it('los tres paneles pasan el periodo del libro', () => {
    for (const f of ['app/api/admin/inicio/route.js', 'app/api/admin/usuarios/route.js', 'app/api/admin/negocio/route.js']) {
      expect(readFileSync(f, 'utf8'), f).toMatch(/periodosDelUltimoPago\(prisma/)
    }
    expect(readFileSync('app/api/admin/negocio/route.js', 'utf8')).toMatch(/const trialsCalientes = trials\.filter\(t => calientesMedidos\.has\(t\.id\)\)/)
  })
})
