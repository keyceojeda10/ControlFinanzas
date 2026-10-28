import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { prestaSinPermiso, situacionParaPrestar } from '@/lib/dinero/permiso-prestamo'

// 28 oct 2026, PRESTA MIL: «los cobradores le hacen varios préstamos al mismo
// cliente saltándose la renovación». El permiso existía por cobrador (cf-v1214)
// pero los 10 lo tenían abierto, como nacen, y no hubo ni una solicitud. Ahora
// también hay una llave del negocio, en Configuración.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('las dos llaves', () => {
  it('presta sin permiso solo si las dos están abiertas', () => {
    expect(prestaSinPermiso({ puedePrestarConPrestamoActivo: true }, { permisoParaPrestarConDeuda: false })).toBe(true)
    expect(prestaSinPermiso({ puedePrestarConPrestamoActivo: true }, { permisoParaPrestarConDeuda: true })).toBe(false)
    expect(prestaSinPermiso({ puedePrestarConPrestamoActivo: false }, { permisoParaPrestarConDeuda: false })).toBe(false)
    // Sin dato, como nacen: abierto.
    expect(prestaSinPermiso({}, null)).toBe(true)
  })
})

describe('con la llave del negocio encendida', () => {
  const db = ({ negocio, vivos = 1 }) => ({
    user: { findUnique: async () => ({ puedePrestarConPrestamoActivo: true, organization: { permisoParaPrestarConDeuda: negocio } }) },
    prestamo: { findMany: async () => Array.from({ length: vivos }, (_, i) => ({ id: `p${i}`, totalAPagar: 120000, totalPagado: 20000, pagos: [] })) },
    permisoPrestamo: { findFirst: async () => null },
  })
  const pide = { organizationId: 'o', clienteId: 'c', userId: 'u', rol: 'cobrador', country: 'co' }

  it('el cobrador con su llave abierta pide permiso si el cliente ya debe', async () => {
    const s = await situacionParaPrestar(db({ negocio: true }), pide)
    expect(s.necesita).toBe(true)
    expect(s.saldo).toBe(100000)
  })
  it('a quien no debe nada no le pide nada', async () => {
    expect((await situacionParaPrestar(db({ negocio: true, vivos: 0 }), pide)).necesita).toBe(false)
  })
  it('apagada, como antes', async () => {
    expect((await situacionParaPrestar(db({ negocio: false }), pide)).necesita).toBe(false)
  })
  it('al dueño nunca', async () => {
    expect((await situacionParaPrestar(db({ negocio: true }), { ...pide, rol: 'owner' })).necesita).toBe(false)
  })
})

describe('se enciende en Configuración', () => {
  it('el interruptor, la API y el esquema', () => {
    expect(leer('app/(dashboard)/configuracion/page.jsx')).toContain('checked={!!org?.permisoParaPrestarConDeuda}')
    const api = leer('app/api/configuracion/organizacion/route.js')
    expect(api).toContain('...(permisoParaPrestarConDeuda !== undefined && { permisoParaPrestarConDeuda: !!permisoParaPrestarConDeuda }),')
    expect(api.match(/permisoParaPrestarConDeuda: true/g)).toHaveLength(2)
    expect(leer('prisma/schema.prisma')).toMatch(/permisoParaPrestarConDeuda\s+Boolean @default\(false\)/)
  })
  it('la renovación no se frena', () => {
    expect(leer('app/api/prestamos/[id]/renovar/route.js')).not.toContain('situacionParaPrestar')
  })
})
