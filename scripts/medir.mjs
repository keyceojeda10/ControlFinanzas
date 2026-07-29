// scripts/medir.mjs — MEDIR un elemento de la app y sus hijos.
//
// Es el paso 3 del cotejo de cierre («las medidas de lo que se repite»). Mirar
// dos imágenes detecta los errores de estructura, pero no distingue un punto de
// 8px de uno de 11, ni un radio de 10 de uno de 12. Eso hay que medirlo.
//
//   node scripts/medir.mjs /clientes header
//   node scripts/medir.mjs /dashboard "nav" 1440
//
// Entra con la MISMA cookie que recorrer.mjs (.auditoria/sesion.json). Sin ella
// la app redirige a /login y se mide la pantalla equivocada — que es justo lo
// que pasó al intentar medir desde un navegador sin sesión.

import fs from 'node:fs'
import { chromium } from 'playwright'

// Git Bash traduce un argumento que empieza por «/» a ruta de Windows, así que
// «/clientes» llega como «C:/Program Files/Git/clientes» y la navegación falla
// con una URL absurda. Se acepta con barra o sin ella, y se recupera la cola si
// viene mangleada.
function normalizarRuta(a = '/dashboard') {
  const m = /(?:^|[\\/])Git[\\/](.*)$/.exec(a)
  const limpia = m ? m[1] : a
  return '/' + String(limpia).replace(/^\/+/, '')
}

const ruta = normalizarRuta(process.argv[2])
const selector = process.argv[3] || 'header'
const ancho = Number(process.argv[4] || 390)

const { cookie } = JSON.parse(fs.readFileSync('.auditoria/sesion.json', 'utf8'))

const nav = await chromium.launch()
const ctx = await nav.newContext({
  viewport: { width: ancho, height: 844 },
  deviceScaleFactor: 2,
  // Igual que en recorrer.mjs: el service worker sirve un esqueleto rancio y se
  // acaba midiendo el bundle viejo.
  serviceWorkers: 'block',
})
await ctx.addCookies([{ name: cookie.name, value: cookie.value, url: 'http://localhost:3000' }])
const pag = await ctx.newPage()

// Doble visita: la primera calienta la compilación de la ruta en dev.
await pag.goto(`http://localhost:3000${ruta}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
await pag.waitForTimeout(2500)
await pag.goto(`http://localhost:3000${ruta}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
await pag.waitForTimeout(3000)

const medidas = await pag.evaluate(({ selector }) => {
  const visible = (el) => {
    const s = getComputedStyle(el)
    return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0
  }
  const raiz = [...document.querySelectorAll(selector)].find(visible)
  if (!raiz) return { error: `ningún «${selector}» visible`, url: location.pathname }

  const uno = (el, prof) => {
    const r = el.getBoundingClientRect()
    const s = getComputedStyle(el)
    const etiqueta = el.getAttribute('aria-label') || el.getAttribute('alt') || ''
    const texto = (el.children.length === 0 ? el.textContent : '').trim().slice(0, 22)
    return {
      prof,
      que: el.tagName.toLowerCase() + (etiqueta ? `[${etiqueta}]` : '') + (texto ? ` «${texto}»` : ''),
      caja: `${Math.round(r.width)}×${Math.round(r.height)}`,
      x: Math.round(r.x),
      radio: s.borderRadius === '0px' ? '' : s.borderRadius,
      relleno: s.padding === '0px' ? '' : s.padding,
      hueco: s.gap === 'normal' || s.gap === '0px' ? '' : s.gap,
      borde: s.borderWidth === '0px' ? '' : `${s.borderWidth} ${s.borderColor}`,
      fondo: /rgba\(0, 0, 0, 0\)|transparent/.test(s.backgroundColor) ? '' : s.backgroundColor,
      flex: s.flexGrow === '0' && s.flexShrink === '0' ? 'none' : `${s.flexGrow} ${s.flexShrink}`,
      cifras: s.fontVariantNumeric,
    }
  }

  const filas = []
  const bajar = (el, prof) => {
    if (prof > 3) return
    filas.push(uno(el, prof))
    for (const h of el.children) bajar(h, prof + 1)
  }
  bajar(raiz, 0)
  return { url: location.pathname, filas }
}, { selector })

await nav.close()

if (medidas.error) {
  console.error(`${medidas.error}  (estaba en ${medidas.url})`)
  process.exit(1)
}

console.log(`${medidas.url} · «${selector}» · ${ancho}px\n`)
for (const f of medidas.filas) {
  const extras = [
    f.caja.padEnd(9),
    ('x' + f.x).padEnd(6),
    f.radio && `r=${f.radio}`,
    f.relleno && `p=${f.relleno}`,
    f.hueco && `gap=${f.hueco}`,
    f.borde && `b=${f.borde}`,
    f.fondo && `bg=${f.fondo}`,
    f.flex === 'none' ? '' : `flex=${f.flex}`,
    /tabular/.test(f.cifras) ? 'tabular' : '',
  ].filter(Boolean).join('  ')
  console.log(`${'  '.repeat(f.prof)}${f.que.padEnd(30 - f.prof * 2)} ${extras}`)
}
