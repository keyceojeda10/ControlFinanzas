import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// 27 oct 2026, PRESTA MIL: a los cobradores se les fue «Gestión» —y con ella
// «Financiar el saldo»— de la ficha del préstamo, teniendo el permiso. Desde
// cf-v1205 la sesión se renueva cada 10 min; si una renovación falla, next-auth
// la deja en null y no la vuelve a pedir, y `useAuth` daba todos los permisos
// en falso. Reproducido en el espejo con .auditoria/_gestion-sesion-perdida.mjs.

const sesion = { data: null, status: 'unauthenticated' }
vi.mock('next-auth/react', () => ({
  useSession: () => ({ ...sesion, update: () => {} }),
  SessionProvider: ({ children }) => children,
}))

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')
const COBRADOR = { email: 'c@e.co', rol: 'cobrador', organizationId: 'org', permisos: { gestionarPrestamos: true, crearPrestamos: true } }

let guardado
beforeEach(() => {
  guardado = {}
  vi.stubGlobal('localStorage', {
    getItem: (k) => guardado[k] ?? null,
    setItem: (k, v) => { guardado[k] = String(v) },
  })
})
afterEach(() => { vi.unstubAllGlobals(); sesion.data = null; sesion.status = 'unauthenticated' })

describe('sin sesión, los permisos son los de la última de este teléfono', () => {
  beforeEach(() => { vi.stubGlobal('window', {}) })

  it('el cobrador sigue viendo Gestión', async () => {
    guardado['cf-session-cache'] = JSON.stringify({ user: COBRADOR })
    const { useAuth } = await import('@/hooks/useAuth')
    const a = useAuth()
    expect(a.puedeGestionarPrestamos).toBe(true)
    expect(a.esCobrador).toBe(true)
    expect(a.esOwner).toBe(false)
    expect(a.organizationId).toBe('org')
    // `session` no se inventa: sigue siendo la de verdad.
    expect(a.session).toBe(null)
  })

  it('con sesión manda la sesión (el dueño pudo quitarle el permiso)', async () => {
    guardado['cf-session-cache'] = JSON.stringify({ user: COBRADOR })
    sesion.data = { user: { ...COBRADOR, permisos: { gestionarPrestamos: false, crearPrestamos: false } } }
    sesion.status = 'authenticated'
    const { useAuth } = await import('@/hooks/useAuth')
    expect(useAuth().puedeGestionarPrestamos).toBe(false)
  })

  it('sin sesión ni nada guardado, nada', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    const a = useAuth()
    expect(a.puedeGestionarPrestamos).toBe(false)
    expect(a.rol).toBe(null)
  })
})

describe('la sesión perdida se vuelve a pedir', () => {
  let disparados
  const montarVentana = ({ ruta = '/prestamos/x', enLinea = true } = {}) => {
    disparados = []
    vi.stubGlobal('window', { location: { pathname: ruta }, dispatchEvent: (e) => disparados.push(e) })
    vi.stubGlobal('navigator', { onLine: enLinea })
    vi.stubGlobal('StorageEvent', class { constructor(tipo, init) { this.type = tipo; Object.assign(this, init) } })
  }

  it('con la sesión guardada, le avisa a next-auth como lo haría otra pestaña', async () => {
    montarVentana()
    guardado['cf-session-cache'] = JSON.stringify({ user: COBRADOR })
    const { pedirSesionOtraVez } = await import('@/lib/sesion-perdida')
    pedirSesionOtraVez()
    expect(disparados).toHaveLength(1)
    expect(disparados[0].type).toBe('storage')
    expect(disparados[0].key).toBe('nextauth.message')
    const msg = JSON.parse(disparados[0].newValue)
    expect(msg.event).toBe('session')
    expect(msg.data).toBeTruthy()
  })

  it('no en /login, ni sin sesión guardada, ni sin señal', async () => {
    const { pedirSesionOtraVez } = await import('@/lib/sesion-perdida')
    montarVentana({ ruta: '/login' })
    guardado['cf-session-cache'] = JSON.stringify({ user: COBRADOR })
    pedirSesionOtraVez()
    expect(disparados).toHaveLength(0)

    montarVentana({ enLinea: false })
    pedirSesionOtraVez()
    expect(disparados).toHaveLength(0)

    montarVentana()
    delete guardado['cf-session-cache']
    pedirSesionOtraVez()
    expect(disparados).toHaveLength(0)
  })

  it('cada 30 s, al volver la señal y al volver a la app, mientras falte', () => {
    expect(leer('lib/sesion-perdida.js')).toContain('export const PEDIR_OTRA_VEZ_CADA_MS = 30 * 1000')
    const src = leer('components/providers/SessionProvider.jsx')
    expect(src).toMatch(/if \(status !== 'unauthenticated'\) return\n\s+pedirSesionOtraVez\(\)\n\s+const reloj = setInterval\(pedirSesionOtraVez, PEDIR_OTRA_VEZ_CADA_MS\)/)
    expect(src).toContain("window.addEventListener('online', pedirSesionOtraVez)")
    expect(src).toContain("document.addEventListener('visibilitychange', alVolver)")
  })
})

/* El arreglo usa una puerta interna de next-auth 4: su aviso entre pestañas.
   Si una actualización la cambia, esto se pone en rojo antes de que vuelva a
   pasar en la calle. */
describe('lo de next-auth de lo que depende', () => {
  it('el aviso «session» de nextauth.message vuelve a pedir la sesión aunque esté en null', () => {
    const react = leer('node_modules/next-auth/react/index.js')
    expect(react).toMatch(/broadcast\.receive\(function \(\) \{\s*return __NEXTAUTH\._getSession\(\{\s*event: "storage"\s*\}\);/)
    expect(react).toMatch(/storageEvent = event === "storage";\s*if \(!\(storageEvent \|\| __NEXTAUTH\._session === undefined\)\)/)
    const utils = leer('node_modules/next-auth/client/_utils.js')
    expect(utils).toContain('"nextauth.message"')
    expect(utils).toMatch(/window\.addEventListener\("storage", handler\)/)
    expect(utils).toMatch(/\.event\) !== "session"/)
  })
})
