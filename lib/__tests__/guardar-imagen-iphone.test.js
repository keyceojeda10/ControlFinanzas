import { describe, it, expect, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { esIOS, guardarImagen } from '@/lib/lienzo-compartir'

// Inducción del 18 nov 2026, error 4: «Guardar» del recibo no llegaba a la
// galería del iPhone. En iOS una descarga va a Archivos; a Fotos llega la hoja
// de compartir del teléfono («Guardar imagen»).

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1'
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Mobile Safari/537.36'
const navDe = (userAgent, extra = {}) => ({
  userAgent, platform: '', maxTouchPoints: 0,
  canShare: () => true, share: vi.fn(() => Promise.resolve()), ...extra,
})

describe('guardar una imagen en el teléfono', () => {
  it('reconoce el iPhone y el iPad que se presenta como Mac', () => {
    expect(esIOS(navDe(IPHONE))).toBe(true)
    expect(esIOS(navDe('Mozilla/5.0 (Macintosh)', { platform: 'MacIntel', maxTouchPoints: 5 }))).toBe(true)
    expect(esIOS(navDe(ANDROID))).toBe(false)
  })

  it('en iPhone abre la hoja del teléfono con el archivo solo', () => {
    const nav = navDe(IPHONE)
    const file = { name: 'Recibo-Ana.png' }
    expect(guardarImagen({ file, url: 'data:x', nombre: 'Recibo-Ana.png' }, nav)).toBe(true)
    expect(nav.share).toHaveBeenCalledWith({ files: [file] })
  })

  it('el recibo usa esa función en sus dos botones de guardar', () => {
    const hoja = readFileSync('components/recibos/HojaReciboPrevio.jsx', 'utf8')
    expect((hoja.match(/onClick=\{guardarEnElTelefono\}/g) || []).length).toBe(2)
  })

  it('el QR y el comprobante firmado preparan la imagen antes del toque', () => {
    // Armarla dentro del toque (cargar el SVG, dibujar, toBlob) hace que el
    // iPhone rechace la hoja de compartir sin decir nada.
    const qr = readFileSync('components/clientes/QrClienteModal.jsx', 'utf8')
    expect(qr).toMatch(/guardarImagen\(\{ file: listo\.current\.file, url: listo\.current\.url, nombre: nombreArchivo \}\)/)
    expect(qr).not.toMatch(/link\.download/)
    const firma = readFileSync('components/prestamos/FirmaDigital.jsx', 'utf8')
    expect(firma).toMatch(/guardarImagen\(\{ \.\.\.comprobanteListo\.current, nombre: nombreComprobante \}\)/)
  })
})
