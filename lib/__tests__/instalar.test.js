/* INSTALAR LA APP DE UN TOQUE (19 oct 2026): qué camino toca en cada teléfono. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import { detectar, caminoInstalar, enlaceAChrome, SCRIPT_CAPTURA_INSTALAR } from '@/lib/instalar'

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Mobile Safari/537.36',
  samsung: 'Mozilla/5.0 (Linux; Android 13; SM-A135M) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/25.0 Chrome/121.0.0.0 Mobile Safari/537.36',
  facebookAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/480.0.0.0;]',
  instagramAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36 Instagram 350.0.0.0 Android',
  safariIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/129.0.0.0 Mobile/15E148 Safari/604.1',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0.0.0',
  escritorio: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
}

describe('el camino para instalar', () => {
  it('Android con el aviso del navegador: un toque', () => {
    expect(caminoInstalar(detectar(UA.chromeAndroid), { hayToque: true })).toBe('un-toque')
    expect(caminoInstalar(detectar(UA.samsung), { hayToque: true })).toBe('un-toque')
    expect(detectar(UA.samsung).navegador).toBe('samsung')
  })
  it('dentro de Facebook o Instagram: a Chrome (Android) o a Safari (iPhone), aunque haya aviso', () => {
    expect(detectar(UA.facebookAndroid).dentroDe).toBe('facebook')
    expect(caminoInstalar(detectar(UA.facebookAndroid), { hayToque: true })).toBe('abrir-en-chrome')
    expect(caminoInstalar(detectar(UA.instagramAndroid))).toBe('abrir-en-chrome')
    expect(caminoInstalar(detectar(UA.instagramIphone))).toBe('ios-dentro')
  })
  it('iPhone: la flecha al Compartir de su navegador', () => {
    expect(caminoInstalar(detectar(UA.safariIphone))).toBe('ios-safari')
    expect(caminoInstalar(detectar(UA.chromeIphone))).toBe('ios-chrome')
  })
  it('sin aviso todavía, o en escritorio: los pasos', () => {
    expect(caminoInstalar(detectar(UA.chromeAndroid))).toBe('pasos')
    expect(caminoInstalar(detectar(UA.escritorio))).toBe('pasos')
  })
  it('el salto a Chrome conserva la dirección y vuelve a ella si no hay Chrome', () => {
    const e = enlaceAChrome('https://app.control-finanzas.com/instalar?de=wa')
    expect(e).toBe('intent://app.control-finanzas.com/instalar?de=wa#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Fapp.control-finanzas.com%2Finstalar%3Fde%3Dwa;end')
  })
  it('el aviso del navegador se oye en el <head>, antes que React', () => {
    expect(SCRIPT_CAPTURA_INSTALAR).toContain("addEventListener('beforeinstallprompt'")
    expect(SCRIPT_CAPTURA_INSTALAR).toContain('window.__cfInstalar = e')
    const layout = fs.readFileSync('app/layout.js', 'utf8')
    expect(layout).toContain('<script dangerouslySetInnerHTML={{ __html: SCRIPT_CAPTURA_INSTALAR }} />')
  })
})

describe('la ventana de instalar de Chrome, como una ficha de tienda', () => {
  const m = JSON.parse(fs.readFileSync('app/manifest.json', 'utf8'))
  it('el id es el que Chrome ya le daba (start_url): no se duplica la app instalada', () => {
    expect(m.id).toBe(m.start_url)
  })
  it('lleva descripción y capturas de teléfono que existen con su tamaño', () => {
    expect(m.description.length).toBeGreaterThan(20)
    const tel = m.screenshots.filter((c) => c.form_factor === 'narrow')
    expect(tel.length).toBeGreaterThanOrEqual(1)
    for (const c of tel) {
      expect(fs.existsSync(`public${c.src}`), c.src).toBe(true)
      const [w, h] = c.sizes.split('x').map(Number)
      expect(h / w).toBeLessThanOrEqual(2.3)   // el límite de Chrome
    }
  })
})

describe('todos los botones de instalar pasan por el mismo timbre', () => {
  const lee = (f) => fs.readFileSync(f, 'utf8')
  it('Más, Configuración, la campana y /instalar', () => {
    expect(lee('components/pantallas/PantallaMas.jsx')).toContain("pedirInstalar('mas')")
    expect(lee('app/(dashboard)/configuracion/page.jsx')).toContain("pedirInstalar('configuracion')")
    expect(lee('components/layout/NotificationsCenter.jsx')).toContain("pedirInstalar('campana')")
    expect(lee('components/tutoriales/InstalarApp.jsx')).toContain("pedirInstalar('pagina-instalar')")
  })
  it('el timbre abre la ventana del navegador si ya avisó, y mide cada camino', () => {
    const p = lee('components/layout/PuertaInstalacion.jsx')
    expect(p).toMatch(/if \(elegido === 'un-toque'\) \{[\s\S]*aviso\.prompt\(\)/)
    for (const ev of ['instalar_abierto', 'instalar_aceptada', 'instalar_rechazada', 'instalada']) expect(p).toContain(`'${ev}'`)
  })
})
