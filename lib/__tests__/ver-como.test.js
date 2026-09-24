import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const dueno = vi.hoisted(() => ({ id: 'o1', nombre: 'Carlos', rol: 'owner', organizationId: 'org1' }))
vi.mock('@/lib/auth-sesion', () => ({
  usuarioParaSesion: vi.fn(async (id) => (id === 'o1' ? dueno : null)),
  sesionDeUsuario: vi.fn(async (u) => ({ id: u.id, nombre: u.nombre, rol: u.rol, organizationId: u.organizationId })),
}))

import { volverSiVencio } from '@/lib/token-de-sesion'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')

describe('la vuelta sola a la hora', () => {
  it('vencida la vista, el token vuelve a ser del dueño', async () => {
    const t = { id: 'c1', rol: 'cobrador', vistaDe: { id: 'o1', nombre: 'Carlos' }, soloLectura: true, vistaHasta: 1000 }
    const r = await volverSiVencio(t, 2000)
    expect(r).toMatchObject({ id: 'o1', rol: 'owner', soloLectura: false, vistaDe: null, vistaHasta: null })
  })
  it('si el dueño ya no existe o no se puede revisar, SIGUE en solo lectura', async () => {
    const t = { id: 'c1', rol: 'cobrador', vistaDe: { id: 'nadie', nombre: 'X' }, soloLectura: true, vistaHasta: 1000 }
    const r = await volverSiVencio(t, 2000)
    expect(r).toMatchObject({ id: 'c1', soloLectura: true })
  })
  it('antes de la hora no toca nada', async () => {
    const t = { id: 'c1', vistaDe: { id: 'o1' }, soloLectura: true, vistaHasta: 5000 }
    expect(await volverSiVencio(t, 2000)).toBe(t)
  })
  it('al volver, el sub del JWT es el del dueño, no se queda con el del cobrador', async () => {
    const t = { id: 'c1', sub: 'c1', rol: 'cobrador', vistaDe: { id: 'o1', nombre: 'Carlos' }, soloLectura: true, vistaHasta: 1000 }
    const r = await volverSiVencio(t, 2000)
    expect(r.sub).toBe('o1')
  })
})

describe('las rutas y el proveedor', () => {
  it('ver-como: solo el dueño, sin estar ya en vista, y solo cobradores activos de su negocio', () => {
    const r = src('app/api/ver-como/route.js')
    expect(r).toMatch(/session\.user\.rol !== 'owner' \|\| session\.user\.soloLectura/)
    expect(r).toMatch(/where: \{ id: cobradorId, organizationId: session\.user\.organizationId, rol: 'cobrador', activo: true \}/)
    expect(r).toMatch(/accion: 'ver_como_cobrador'/)
  })
  it('volver: solo desde una vista', () => {
    expect(src('app/api/ver-como/volver/route.js')).toMatch(/if \(!session\?\.user\?\.vistaDe\?\.id\)/)
  })
  it('el proveedor vuelve a revisar lo mismo que la ruta', () => {
    const a = src('lib/auth.js')
    expect(a).toMatch(/id: 'pase'/)
    expect(a).toMatch(/cobrador\.organizationId !== duenoPase\.organizationId/)
    expect(a).toMatch(/soloLectura: true, vistaHasta: Date\.now\(\) \+ VISTA_MS/)
  })
  it('la acción tiene su nombre en el Historial', () => {
    expect(src('lib/activity-log-types.js')).toMatch(/ver_como_cobrador: \{ label: 'Vio la app como su cobrador'/)
  })
  it('el Historial tiene su icono (si no, sale un lápiz)', () => {
    expect(src('app/(dashboard)/actividad/page.jsx')).toMatch(/^\s+eye: \(color\) => \(/m)
  })
})
