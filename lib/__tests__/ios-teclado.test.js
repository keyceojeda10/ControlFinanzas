import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { esAppInstaladaEnIOS, queHacerTrasElTeclado } from '@/lib/ios-teclado'

// Inducción del 18 nov 2026, errores 2, 3 y 6: la app instalada en el iPhone
// quedaba encogida o corrida después del teclado. Ver lib/ios-teclado.js.

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'

describe('solo en la app instalada del iPhone', () => {
  it('iPhone instalado sí; Safari, Android y el PC no', () => {
    expect(esAppInstaladaEnIOS({ userAgent: IPHONE, standalone: true })).toBe(true)
    expect(esAppInstaladaEnIOS({ userAgent: IPHONE, displayStandalone: true })).toBe(true)
    expect(esAppInstaladaEnIOS({ userAgent: IPHONE })).toBe(false)
    expect(esAppInstaladaEnIOS({ userAgent: 'Mozilla/5.0 (Linux; Android 14)', displayStandalone: true })).toBe(false)
    expect(esAppInstaladaEnIOS({ userAgent: 'Mozilla/5.0 (Macintosh)', platform: 'MacIntel', maxTouchPoints: 0, displayStandalone: true })).toBe(false)
  })
})

describe('qué hacer cuando se cierra el teclado', () => {
  it('con el teclado todavía arriba, nada', () => {
    expect(queHacerTrasElTeclado({ alto: 600, altoMaximo: 932, escribiendo: true })).toBe('nada')
  })
  it('la ventana se quedó corta (932 → 873): remedir', () => {
    expect(queHacerTrasElTeclado({ alto: 873, altoMaximo: 932, visibleAlto: 873, visibleTop: 0 })).toBe('remedir')
  })
  it('solo desplazada (iOS 26): reacomodar', () => {
    expect(queHacerTrasElTeclado({ alto: 932, altoMaximo: 932, visibleAlto: 908, visibleTop: 0 })).toBe('reacomodar')
    expect(queHacerTrasElTeclado({ alto: 932, altoMaximo: 932, visibleAlto: 932, visibleTop: 24 })).toBe('reacomodar')
  })
  it('bien, o con diferencias de redondeo: nada', () => {
    expect(queHacerTrasElTeclado({ alto: 932, altoMaximo: 932, visibleAlto: 932, visibleTop: 0 })).toBe('nada')
    expect(queHacerTrasElTeclado({ alto: 930, altoMaximo: 932, visibleAlto: 929.5, visibleTop: 1 })).toBe('nada')
  })
})

describe('el layout raíz lo monta', () => {
  it('en las dos ramas del layout (páginas públicas y la app): /login no tiene armazón', () => {
    const lay = readFileSync('app/layout.js', 'utf8')
    expect((lay.match(/<ReparoTecladoIOS \/>/g) || []).length).toBe(2)
  })
  it('solo actúa en la app instalada del iPhone y con freno', () => {
    const comp = readFileSync('components/armazon/ReparoTecladoIOS.js', 'utf8')
    expect(comp).toMatch(/if \(!instalada\) return undefined/)
    expect(comp).toMatch(/if \(que === 'remedir' && fallos < MAX_FALLOS\)/)
  })
})
