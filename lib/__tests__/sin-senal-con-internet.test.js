/* PRESTA MIL, 21-22 oct 2026: «le sale como sin internet y ya me ha mandado
   pruebas de que sí tiene internet». Su app bajaba 14,6 MB sin comprimir cada
   90 s; mientras bajaba el ping pasaba de 4 s, UN fallo la declaraba sin señal
   y al volver el ping se disparaba otra descarga entera. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { jsonComprimido } from '@/lib/http/json-comprimido'

describe('el sync offline viaja comprimido', () => {
  const grande = { clientes: Array.from({ length: 300 }, (_, i) => ({ id: `c${i}`, nombre: 'Cliente', pagos: [1, 2, 3] })) }
  it('con Accept-Encoding: gzip sale en gzip y se lee igual', async () => {
    const r = await jsonComprimido(new Request('http://x', { headers: { 'accept-encoding': 'gzip, br' } }), grande)
    expect(r.headers.get('content-encoding')).toBe('gzip')
    const buf = Buffer.from(await r.arrayBuffer())
    expect(buf.length).toBeLessThan(JSON.stringify(grande).length / 5)
    expect(JSON.parse(gunzipSync(buf).toString())).toEqual(grande)
  })
  it('sin gzip, o si es pequeño, va tal cual', async () => {
    const sin = await jsonComprimido(new Request('http://x'), grande)
    expect(sin.headers.get('content-encoding')).toBeNull()
    expect(await sin.json()).toEqual(grande)
    const chico = await jsonComprimido(new Request('http://x', { headers: { 'accept-encoding': 'gzip' } }), { ok: 1 })
    expect(chico.headers.get('content-encoding')).toBeNull()
  })
  it('la ruta del sync lo usa', () => {
    expect(readFileSync('app/api/offline/sync/route.js', 'utf8')).toMatch(/return jsonComprimido\(request, \{\n\s+syncedAt:/)
  })
})

describe('un ping lento no es «sin señal»', () => {
  afterEach(() => vi.unstubAllGlobals())
  let con
  const ping = (ok) => { vi.stubGlobal('fetch', vi.fn(async () => (ok ? new Response('pong') : Promise.reject(new Error('abort'))))) }
  beforeEach(async () => {
    vi.resetModules()
    vi.stubGlobal('navigator', { onLine: true })
    con = await import('@/lib/connectivity')
  })
  it('hacen falta dos fallos seguidos', async () => {
    ping(true); expect(await con.hayInternetReal({ forzar: true })).toBe(true)
    ping(false); expect(await con.hayInternetReal({ forzar: true })).toBe(true)
    expect(con.ultimoEstadoConexion()).toBe(true) // las pantallas no cortan a 1,5 s
    ping(false); expect(await con.hayInternetReal({ forzar: true })).toBe(false)
    ping(true); expect(await con.hayInternetReal({ forzar: true })).toBe(true)
  })
  it('mientras baja la copia, los fallos no cuentan', async () => {
    con.marcarDescarga(true)
    ping(false)
    for (let k = 0; k < 4; k++) expect(await con.hayInternetReal({ forzar: true })).toBe(true)
    con.marcarDescarga(false)
    expect(await con.hayInternetReal({ forzar: true })).toBe(true)
    expect(await con.hayInternetReal({ forzar: true })).toBe(false)
  })
  it('sin interfaz de red es inmediato', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    expect(await con.hayInternetReal({ forzar: true })).toBe(false)
  })
})

describe('la copia entera no se baja a cada rato', () => {
  const src = readFileSync('components/providers/OfflineProvider.jsx', 'utf8')
  it('como mucho cada 5 minutos, salvo que se pida', () => {
    expect(src).toContain('const MIN_DESCARGA_COMPLETA_MS = 5 * 60_000')
    expect(src).toMatch(/if \(!forzar && reciente\) \{/)
    expect(src).toContain('forzar = !silent }')
  })
  it('«volvió la señal» ya no fuerza la descarga (era el bucle)', () => {
    expect(src).toContain("syncPendingThenFull({ silent: false, signalPages: true, forzar: false }), 1500)")
  })
  it('la descarga avisa al detector de señal', () => {
    expect(readFileSync('lib/offline.js', 'utf8')).toMatch(/marcarDescarga\(true\)[\s\S]{0,300}\/api\/offline\/sync[\s\S]{0,300}finally \{\n\s+marcarDescarga\(false\)/)
  })
})
