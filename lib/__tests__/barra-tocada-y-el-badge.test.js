/* LA BARRA QUE SE TOCA Y EL ICONO DE LA NOTIFICACIÓN — 20 sep 2026.
 *
 * Dos cosas que el dueño reportó el mismo domingo, con fotos:
 *
 * 1. «Le doy a las barritas del recaudado y no muestra nada; eso funcionaba».
 *    La frase del día tocado se había metido DENTRO de `cumplieron != null`, y
 *    `cumplieron` es null cuando hoy no toca cobrar. En domingo el recuadro de
 *    selección aparecía y no salía texto. Es la TERCERA vez que esta gráfica
 *    pierde la función de tocarla (antes: `<button>` → `<span>` con `title`).
 *
 * 2. «En la notificación sale un círculo blanco, y en la barra de arriba un
 *    cuadrito blanco». El `icon` era un SVG —Chrome en Android no lo pinta— y
 *    el `badge` era el logo cuadrado opaco, que Android usa de máscara alfa: un
 *    cuadrado lleno da un cuadrado blanco. */
import { describe, it, expect } from 'vitest'
import fs from 'fs'
import path from 'path'

const leer = (f) => fs.readFileSync(path.join(process.cwd(), f), 'utf8')

describe('la barra tocada habla aunque hoy no toque cobrar', () => {
  const panel = leer('components/pantallas/Panel.jsx')

  it('la frase del día NO cuelga de `cumplieron`, que es null sin meta', () => {
    expect(panel).toContain('{(diaAbierto != null || cumplieron != null) && (')
    // La forma vieja, la que dejó muda la gráfica los domingos.
    expect(panel).not.toMatch(/\{cumplieron != null && \(\s*\n\s*<p/)
  })

  it('las barras siguen siendo botones: un `title` no se toca con el dedo', () => {
    const i = panel.indexOf('{barras.map((n, i) => {')
    expect(i).toBeGreaterThan(-1)
    const bloque = panel.slice(i, i + 900)
    expect(bloque).toContain('<button')
    expect(bloque).toContain('onClick={() => setDiaAbierto(')
    expect(bloque).toContain('aria-label={`${dias[i]')
  })

  it('y dice en cuántos cobros fue, con el cero por su nombre', () => {
    expect(panel).toContain('cobrosDelDia')
    expect(panel).toContain('no entró plata ese día')
    expect(panel).toMatch(/cobro\{cobrosDelDia === 1 \? '' : 's'\}/)
  })

  it('el promedio se saca de los días CON cobro, no de los siete', () => {
    expect(panel).toContain('const conCobro = barras.filter((n) => n > 0)')
  })

  it('y el dato viaja: el API lo manda y el adaptador lo pasa', () => {
    const api = leer('app/api/dashboard/resumen/route.js')
    const i = api.indexOf('sparkline7d,')
    expect(api.slice(i, i + 500)).toContain('cobros7d,')
    expect(leer('lib/adaptadores/panel.js')).toContain('cobrosSemana:')
  })
})

describe('el icono de la notificación', () => {
  const sw = leer('public/sw.js')
  const push = leer('lib/push.js')

  it('nunca es un SVG: Chrome en Android no lo pinta y deja el hueco', () => {
    for (const m of sw.match(/icon: [^,\n]+/g) ?? []) expect(m, m).not.toContain('.svg')
    for (const m of push.match(/icon: [^,\n]+/g) ?? []) expect(m, m).not.toContain('.svg')
    expect(push).toContain("icon: payload.icon || '/icons/icon-192.png'")
  })

  it('el badge es la silueta, no el logo cuadrado (Android lo usa de máscara)', () => {
    expect(sw.match(/badge: '\/icons\/badge-96\.png'/g)).toHaveLength(2)
    expect(sw).not.toContain("badge: '/icons/icon-192.png'")
  })

  it('el badge existe, es PNG y está casi todo transparente', () => {
    const f = path.join(process.cwd(), 'public/icons/badge-96.png')
    expect(fs.existsSync(f)).toBe(true)
    const buf = fs.readFileSync(f)
    expect(buf.subarray(1, 4).toString()).toBe('PNG')
    // IHDR: ancho, alto y tipo de color (6 = RGBA, con canal alfa).
    expect(buf.readUInt32BE(16)).toBe(96)
    expect(buf.readUInt32BE(20)).toBe(96)
    expect(buf[25]).toBe(6)
  })

  it('y el service worker lo cachea, o el primer aviso sin señal se queda sin él', () => {
    expect(sw).toContain("'/icons/badge-96.png',")
  })
})
