import { describe, it, expect, afterEach, vi } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { marcarSoloLectura, estaEnSoloLectura } from '@/lib/modo-vista'
import { sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones } from '@/lib/offline'

const src = (f) => readFileSync(resolve(process.cwd(), f), 'utf8')
function almacen() {
  const m = new Map()
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }
}
afterEach(() => vi.unstubAllGlobals())

describe('la marca de solo lectura del teléfono', () => {
  it('se enciende y se apaga, y sin almacenamiento dice que no', () => {
    vi.stubGlobal('localStorage', almacen())
    expect(estaEnSoloLectura()).toBe(false)
    marcarSoloLectura(true)
    expect(estaEnSoloLectura()).toBe(true)
    marcarSoloLectura(false)
    expect(estaEnSoloLectura()).toBe(false)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') }, removeItem: () => { throw new Error('x') } })
    expect(estaEnSoloLectura()).toBe(false)
    expect(() => marcarSoloLectura(true)).not.toThrow()
  })

  it('en vista, NINGUNA de las cuatro sincronizaciones sube nada con la sesión del cobrador', async () => {
    vi.stubGlobal('localStorage', almacen())
    vi.stubGlobal('navigator', { onLine: true })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    marcarSoloLectura(true)
    for (const sincronizar of [sincronizarPagos, sincronizarOrdenes, sincronizarCreaciones, sincronizarMutaciones]) {
      expect(await sincronizar()).toEqual({ synced: 0, failed: 0 })
    }
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('sin rastro en el cobrador', () => {
  const offline = src('lib/offline.js')
  it('en vista no se guarda nada para uso sin conexión ni se descarga la cartera', () => {
    expect(offline).toMatch(/export async function guardarEnCache\(key, data\) \{\n\s+if \(estaEnSoloLectura\(\)\) return/)
    expect(offline).toMatch(/export async function sincronizarTodo\(onProgress\) \{\n\s+if \(estaEnSoloLectura\(\)\) return \{ clientes: 0, prestamos: 0, rutas: 0, syncedAt: null \}/)
  })
  it('el ping de sesión y las notificaciones no corren en vista', () => {
    expect(src('components/providers/SesionTracker.jsx')).toMatch(/if \(session\.user\.soloLectura\) return/)
    expect(src('lib/push-cliente.js')).toMatch(/export async function activarPush\(\) \{\n\s+if \(estaEnSoloLectura\(\)\) return 'apagado'/)
  })
  it('al cambiar de identidad se tiran las lecturas y la sesión guardada, NO los cobros pendientes', () => {
    const c = src('lib/cambio-de-cuenta.js')
    expect(c).toMatch(/postMessage\(\{ type: 'CLEAR_API_CACHE' \}\)/)
    expect(c).toMatch(/await borrarCacheDeLecturas\(\)/)
    expect(c).toMatch(/localStorage\.removeItem\(CLAVE_SESION_GUARDADA\)/)
    expect(c).not.toMatch(/limpiarDatosOffline/)
    // La clave tiene que ser la MISMA que usa el SessionProvider.
    const clave = c.match(/const CLAVE_SESION_GUARDADA = '([^']+)'/)[1]
    expect(src('components/providers/SessionProvider.jsx')).toContain(`const STORAGE_KEY = '${clave}'`)
  })
})

describe('la entrada y la salida', () => {
  it('el botón y la franja usan el pase', () => {
    expect(src('components/cobradores/BotonVerComo.jsx')).toMatch(/signIn\('pase', \{ pase: d\.pase, redirect: false \}\)/)
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/ver-como\/volver', \{ method: 'POST' \}\)/)
    expect(src('app/(dashboard)/layout.jsx')).toMatch(/<FranjaVerComo \/>/)
  })
  it('a la hora, la franja reescribe la cookie y solo sale si la sesión nueva ya no es de vista (sin bucles)', () => {
    const franja = src('components/armazon/FranjaVerComo.jsx')
    expect(franja).toMatch(/fetch\('\/api\/auth\/session'\)/)
    expect(franja).toMatch(/if \(nueva\?\.user && !nueva\.user\.soloLectura\) return salir\(cobradorId\)/)
  })
})
