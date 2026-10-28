import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { situacionParaPrestar, textoNecesitaPermiso } from '@/lib/dinero/permiso-prestamo'

// El 27 oct 2026 el mejor cliente del dueño pidió que el cobrador no le pueda
// hacer otra cartulina a un cliente que ya debe sin su permiso. Decisión: un
// permiso por cobrador (encendido por defecto) y, apagado, una solicitud que el
// dueño aprueba en la app. La renovación NO se frena.

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

function db({ puede = false, prestamos = [], permiso = null } = {}) {
  const llamadas = { prestamo: null, permiso: null }
  return {
    llamadas,
    user: { findUnique: async () => ({ puedePrestarConPrestamoActivo: puede }) },
    prestamo: { findMany: async (q) => { llamadas.prestamo = q; return prestamos } },
    permisoPrestamo: { findFirst: async (q) => { llamadas.permiso = q; return permiso } },
  }
}
const debe = (total, pagado) => ({ id: 'p', totalAPagar: total, totalPagado: pagado, pagos: [{ montoPagado: pagado, tipo: 'completo' }] })
const base = { organizationId: 'o', clienteId: 'c', userId: 'u', rol: 'cobrador', country: 'co' }

describe('situacionParaPrestar', () => {
  it('el dueño nunca necesita permiso', async () => {
    const s = await situacionParaPrestar(db({ prestamos: [debe(100, 0)] }), { ...base, rol: 'owner' })
    expect(s.necesita).toBe(false)
  })
  it('el cobrador con el permiso encendido presta como siempre', async () => {
    const s = await situacionParaPrestar(db({ puede: true, prestamos: [debe(100, 0)] }), base)
    expect(s.necesita).toBe(false)
  })
  it('sin préstamos vivos no hay nada que pedir', async () => {
    const s = await situacionParaPrestar(db(), base)
    expect(s.necesita).toBe(false)
  })
  it('con uno vivo y el permiso apagado, lo necesita y dice cuánto debe', async () => {
    const d = db({ prestamos: [debe(120000, 20000)] })
    const s = await situacionParaPrestar(d, base)
    expect(s).toMatchObject({ necesita: true, cantidad: 1, saldo: 100000, permiso: null })
    // Cuentan el que se cobra y el que espera aprobación; no el saldado ni el cancelado.
    expect(d.llamadas.prestamo.where.estado).toEqual({ in: ['activo', 'pendiente_aprobacion'] })
  })
  it('el permiso que mira es el de HOY, de este cobrador y este cliente', async () => {
    const d = db({ prestamos: [debe(100, 0)], permiso: { id: 'x', estado: 'aprobado' } })
    const s = await situacionParaPrestar(d, base)
    expect(s.permiso.estado).toBe('aprobado')
    expect(d.llamadas.permiso.where).toMatchObject({ organizationId: 'o', clienteId: 'c', cobradorId: 'u' })
    expect(d.llamadas.permiso.where.createdAt.gte).toBeInstanceOf(Date)
  })
  it('el texto dice cuántos y cuánto', () => {
    expect(textoNecesitaPermiso({ cantidad: 2, saldo: 350000 })).toContain('ya tiene 2 préstamos activos y debe $350.000')
  })
})

describe('el servidor frena y gasta el permiso', () => {
  const src = leer('app/api/prestamos/route.js')
  it('frena antes de la transacción', () => {
    const freno = src.indexOf('const situacion = await situacionParaPrestar(prisma, {')
    expect(freno).toBeGreaterThan(-1)
    expect(freno).toBeLessThan(src.indexOf('const prestamo = await prisma.$transaction('))
    expect(src).toMatch(/if \(situacion\.permiso\?\.estado !== 'aprobado'\) \{\s*return Response\.json\(\{/)
  })
  it('lo gasta dentro de la transacción, solo si sigue aprobado', () => {
    const tx = src.slice(src.indexOf('const prestamo = await prisma.$transaction('))
    expect(tx).toMatch(/tx\.permisoPrestamo\.updateMany\(\{\s*where: \{ id: permisoAUsar, estado: 'aprobado' \}/)
    expect(tx).toMatch(/if \(count === 0\) throw new Error\('PERMISO_USADO'\)/)
  })
  it('la renovación no se frena (decisión del dueño, 27 oct 2026)', () => {
    expect(leer('app/api/prestamos/[id]/renovar/route.js')).not.toMatch(/situacionParaPrestar/)
  })
})

describe('el dueño lo decide desde «Esperan tu decisión»', () => {
  it('pendientes lista los permisos', () => {
    expect(leer('app/api/notificaciones/pendientes/route.js')).toMatch(/clave: `permiso:\$\{p\.id\}`, clase: 'permiso'/)
  })
  it('el botón llama a su endpoint', () => {
    expect(leer('components/armazon/Pendientes.jsx')).toMatch(/fetch\(`\/api\/prestamos\/permiso\/\$\{p\.id\}`/)
  })
  it('solo resuelve la que sigue pendiente', () => {
    expect(leer('app/api/prestamos/permiso/[id]/route.js')).toMatch(/where: \{ id, organizationId, estado: 'pendiente' \}/)
  })
})

describe('el permiso del cobrador viaja en la sesión por las dos puertas', () => {
  it('login y refresco', () => {
    // Las dos llaves (la del cobrador y la del negocio), en los dos sitios.
    expect(leer('lib/auth-sesion.js')).toMatch(/prestarConPrestamoActivo: prestaSinPermiso\(user, user\.organization\)/)
    expect(leer('lib/auth-sesion.js')).toContain('permisoParaPrestarConDeuda: true')
    expect(leer('lib/auth.js')).toMatch(/prestarConPrestamoActivo: prestaSinPermiso\(fresh, fresh\.organization\)/)
    expect(leer('lib/auth.js')).toMatch(/puedePrestarConPrestamoActivo: true,/)
    expect(leer('lib/auth.js')).toContain('permisoParaPrestarConDeuda: true,')
  })
  it('la pantalla no deja avanzar sin permiso', () => {
    expect(leer('app/(dashboard)/prestamos/nuevo/page.jsx')).toMatch(/if \(faltaPermiso\) return false/)
  })
})
