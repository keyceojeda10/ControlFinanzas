import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// El 26 oct 2026 INVERSIONESJYM reportó que con el modo abreviado escribía
// «50» y quedaban $50. Pasaba cuando falló la renovación de la sesión (cada
// 10 min desde cf-v1205): next-auth dejaba la sesión en null, `useAuth` decía
// `modoAbreviado: false` y el cobro salía igual porque la cookie estaba buena.
// Reproducido en el espejo con .auditoria/_abreviado-sesion-perdida.mjs.

const sesion = { data: null, status: 'unauthenticated' }
vi.mock('next-auth/react', () => ({ useSession: () => ({ ...sesion, update: () => {} }) }))

const leer = (p) => readFileSync(resolve(process.cwd(), p), 'utf8')

describe('el modo abreviado sobrevive a una sesión perdida', () => {
  let guardado
  beforeEach(() => {
    guardado = {}
    vi.stubGlobal('window', {})
    vi.stubGlobal('localStorage', {
      getItem: (k) => guardado[k] ?? null,
      setItem: (k, v) => { guardado[k] = String(v) },
    })
  })
  afterEach(() => { vi.unstubAllGlobals(); sesion.data = null; sesion.status = 'unauthenticated' })

  it('sin sesión a mano, manda la última guardada en el teléfono', async () => {
    guardado['cf-session-cache'] = JSON.stringify({ user: { email: 'c@e.co', modoAbreviado: true } })
    const { useAuth } = await import('@/hooks/useAuth')
    expect(useAuth().modoAbreviado).toBe(true)
  })

  it('con sesión, manda la sesión (el dueño pudo apagarlo)', async () => {
    guardado['cf-session-cache'] = JSON.stringify({ user: { email: 'c@e.co', modoAbreviado: true } })
    sesion.data = { user: { email: 'c@e.co', modoAbreviado: false } }
    sesion.status = 'authenticated'
    const { useAuth } = await import('@/hooks/useAuth')
    expect(useAuth().modoAbreviado).toBe(false)
  })

  it('sin sesión ni nada guardado, apagado', async () => {
    const { useAuth } = await import('@/hooks/useAuth')
    expect(useAuth().modoAbreviado).toBe(false)
  })
})

describe('el servidor frena menos de mil con el modo abreviado', () => {
  const src = leer('app/api/prestamos/[id]/pagos/route.js')
  it('pide el modo del negocio', () => {
    expect(src).toMatch(/select: \{ diasSinCobro: true, modoAbreviado: true \}/)
  })
  it('rechaza el monto antes de la transacción', () => {
    const freno = src.indexOf('if (org?.modoAbreviado && montoFinal > 0 && montoFinal < 1000)')
    expect(freno).toBeGreaterThan(-1)
    expect(freno).toBeLessThan(src.indexOf('prisma.$transaction'))
  })
})

describe('el service worker no convierte un 502 en «sin sesión»', () => {
  const sw = leer('public/sw.js')
  it('la sesión pasa por su propio manejador', () => {
    expect(sw).toMatch(/url\.pathname === '\/api\/auth\/session'\) \{\s*e\.respondWith\(sesionConRespaldo\(request\)\)/)
  })
  it('una respuesta con error devuelve la última buena', () => {
    const fn = sw.slice(sw.indexOf('async function sesionConRespaldo'), sw.indexOf('async function networkFirstAPI'))
    expect(fn).toMatch(/if \(response\.ok && !response\.redirected\)/)
    expect(fn).toMatch(/return cached \|\| response/)
  })
})
