import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    ruta: { findMany: vi.fn(async () => [{ id: 'r1' }, { id: 'r2' }]) },
    suscripcion: { findFirst: vi.fn(async () => null) },
    user: { findUnique: vi.fn(async () => null) },
  },
}))
vi.mock('@/lib/limites-plan', () => ({ usuarioPermitido: vi.fn(async () => true) }))

import { revisarCuenta, armarSesion, sesionDeUsuario } from '@/lib/auth-sesion'

const base = {
  id: 'u1', nombre: 'Juan', email: 'j@x.co', rol: 'cobrador', activo: true, emailVerificado: true,
  createdAt: new Date(), organizationId: 'o1', avatarId: null, onboardingCompletado: true,
  puedeCrearPrestamos: true, puedeCrearClientes: false, puedeEditarClientes: false,
  organization: { plan: 'starter', activo: true, country: 'co', timezone: null, nombre: 'Negocio', modoAbreviado: false, ocultarSaldoWA: false, camposRecibo: null },
}

describe('revisarCuenta', () => {
  it('desactivada, sin verificar (más de 7 días) o suspendida: no entra', () => {
    expect(() => revisarCuenta({ ...base, activo: false })).toThrow(/desactivada/)
    expect(() => revisarCuenta({ ...base, emailVerificado: false, createdAt: new Date(Date.now() - 8 * 86400000) })).toThrow('VERIFY_EMAIL')
    expect(() => revisarCuenta({ ...base, organization: { ...base.organization, activo: false } })).toThrow(/suspendida/)
    expect(() => revisarCuenta(base)).not.toThrow()
  })
})

describe('armarSesion', () => {
  it('cobrador: con sus rutas y sus permisos', async () => {
    const s = await armarSesion(base)
    expect(s).toMatchObject({ id: 'u1', rol: 'cobrador', rutaId: 'r1', rutaIds: ['r1', 'r2'], orgNombre: 'Negocio' })
    expect(s.permisos).toMatchObject({ crearPrestamos: true, crearClientes: false })
  })
})

describe('las entradas comparten la misma función', () => {
  const auth = readFileSync(resolve(process.cwd(), 'lib/auth.js'), 'utf8')
  it('el login con contraseña revisa ANTES de la clave y arma DESPUÉS', () => {
    expect(auth.indexOf('revisarCuenta(user)')).toBeGreaterThan(-1)
    expect(auth.indexOf('revisarCuenta(user)')).toBeLessThan(auth.indexOf('bcrypt.compare(credentials.password'))
    expect(auth).toMatch(/return armarSesion\(user\)/)
  })
  it('sesionDeUsuario = revisar + armar', async () => {
    await expect(sesionDeUsuario({ ...base, activo: false })).rejects.toThrow(/desactivada/)
  })
})
