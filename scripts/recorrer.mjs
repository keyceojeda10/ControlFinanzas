// scripts/recorrer.mjs — captura la app logueada, pantalla por pantalla.
//
// EL PUNTO CIEGO QUE ESTO CIERRA: verificar componentes sueltos en un banco de
// pruebas no detecta lo que falla al integrarlos. Tres barras de navegación
// solapadas en escritorio son invisibles en un marco de 390px, y así llegaron
// hasta el navegador del dueño.
//
//   node scripts/recorrer.mjs [carpeta] [--solo=rutas,caja]
//
// Además de la imagen, anota lo que una captura NO enseña: errores de consola,
// peticiones caídas, y cuántas cabeceras y barras de navegación hay montadas.

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SALIDA = process.argv[2] || '.auditoria/capturas'
const soloArg = process.argv.find((a) => a.startsWith('--solo='))
const solo = soloArg ? soloArg.slice(7).split(',').map((s) => s.trim()) : null

const TAMANOS = [
  { nombre: 'movil', width: 390, height: 844 },
  { nombre: 'escritorio', width: 1440, height: 900 },
]

const PANTALLAS = [
  { ruta: '/dashboard', nombre: 'panel' },
  { ruta: '/cobros-hoy', nombre: 'cobrar-hoy' },
  { ruta: '/clientes', nombre: 'clientes' },
  { ruta: '/prestamos', nombre: 'prestamos' },
  { ruta: '/rutas', nombre: 'rutas' },
  { ruta: '/caja', nombre: 'caja' },
  { ruta: '/mas', nombre: 'mas' },
  { ruta: '/capital', nombre: 'capital' },
  { ruta: '/gastos', nombre: 'gastos' },
  { ruta: '/socios', nombre: 'socios' },
  { ruta: '/clavos', nombre: 'perdidos' },
  { ruta: '/cobradores', nombre: 'cobradores' },
  { ruta: '/reportes', nombre: 'reportes' },
  { ruta: '/configuracion', nombre: 'configuracion' },
]

const { cookie, usuario } = JSON.parse(fs.readFileSync('.auditoria/sesion.json', 'utf8'))
fs.mkdirSync(SALIDA, { recursive: true })

const navegador = await chromium.launch()
const informe = []

for (const tam of TAMANOS) {
  // serviceWorkers bloqueado: si no, la PWA sirve el bundle anterior y se
  // audita una versión que ya no existe.
  const ctx = await navegador.newContext({
    viewport: { width: tam.width, height: tam.height },
    deviceScaleFactor: 2,
    serviceWorkers: 'block',
  })
  await ctx.addCookies([{ name: cookie.name, value: cookie.value, url: 'http://localhost:3000' }])

  // La modal de novedades se abre una vez por version y tapa la pantalla
  // entera. Ya arruino 88 capturas en una tanda anterior: se marca como vista
  // ANTES de navegar, no cerrandola despues.
  await ctx.addInitScript(() => {
    try {
      localStorage.setItem('cf:novedades:visto', '999999')
    } catch {}
  })

  const pag = await ctx.newPage()

  for (const p of PANTALLAS) {
    if (solo && !solo.includes(p.nombre)) continue

    const errores = []
    const fallos = []
    const largo = (t) => (/hydrat|match/i.test(t) ? 2400 : 200)
    const onError = (e) => { const t = String(e.message || e); errores.push(t.slice(0, largo(t))) }
    const onConsola = (m) => { if (m.type() === 'error') { const t = m.text(); errores.push(t.slice(0, largo(t))) } }
    const onFallo = (r) => fallos.push(r.url().replace('http://localhost:3000', ''))
    pag.on('pageerror', onError)
    pag.on('console', onConsola)
    pag.on('requestfailed', onFallo)

    try {
      // DOS visitas. En la primera, Next compila la ruta y sus APIs: el ping de
      // conectividad tarda mas de 4s, la app lo lee como "limbo" y pinta el
      // esqueleto con el aviso de Offline. Auditar eso seria auditar el
      // arranque en frio del servidor de desarrollo, no el diseño.
      await pag.goto(`http://localhost:3000${p.ruta}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
      await pag.waitForTimeout(2500)
      await pag.goto(`http://localhost:3000${p.ruta}`, { waitUntil: 'domcontentloaded', timeout: 45000 })
      await pag.waitForTimeout(3500)
      // Sin esto el barrido dispara el limitador de peticiones y los 429 que
      // salen en el informe son mios, no de la app.
      await pag.waitForTimeout(900)
    } catch (e) {
      errores.push('navegación: ' + String(e.message).slice(0, 120))
    }

    // Lo que una captura no cuenta.
    const armazon = await pag.evaluate(() => {
      const visible = (el) => {
        const s = getComputedStyle(el)
        return s.display !== 'none' && s.visibility !== 'hidden' && el.getBoundingClientRect().height > 0
      }
      return {
        cabeceras: [...document.querySelectorAll('header')].filter(visible).length,
        navs: [...document.querySelectorAll('nav')].filter(visible).length,
        laterales: [...document.querySelectorAll('aside')].filter(visible).length,
        // Scroll horizontal: ningún elemento puede generarlo (regla del sistema).
        desbordaX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
        alto: document.documentElement.scrollHeight,
      }
    }).catch(() => null)

    const archivo = path.join(SALIDA, `${p.nombre}-${tam.nombre}.png`)
    await pag.screenshot({ path: archivo, fullPage: false }).catch(() => {})

    informe.push({ pantalla: p.nombre, tamano: tam.nombre, ruta: p.ruta, ...armazon,
      errores: errores.filter((e) => !e.includes('googletagmanager')),
      fallos: fallos.filter((f) => !f.includes('gtag')) })

    pag.off('pageerror', onError)
    pag.off('console', onConsola)
    pag.off('requestfailed', onFallo)
  }
  await ctx.close()
}
await navegador.close()

fs.writeFileSync(path.join(SALIDA, 'informe.json'), JSON.stringify(informe, null, 1))

// ── Resumen legible ──
console.log(`sesión: ${usuario.email} (${usuario.rol})\n`)
const problemas = []
for (const r of informe) {
  const señales = []
  if (r.cabeceras > 1) señales.push(`${r.cabeceras} cabeceras`)
  if (r.tamano === 'escritorio' && r.navs > 1) señales.push(`${r.navs} navs`)
  if (r.tamano === 'movil' && r.laterales > 0) señales.push('barra lateral en móvil')
  if (r.tamano === 'escritorio' && r.laterales === 0) señales.push('sin barra lateral')
  if (r.desbordaX) señales.push('scroll horizontal')
  if (r.errores?.length) señales.push(`${r.errores.length} error(es)`)
  if (señales.length) problemas.push(`  ${r.pantalla.padEnd(15)} ${r.tamano.padEnd(11)} ${señales.join(' · ')}`)
}
console.log(problemas.length ? 'PROBLEMAS\n' + problemas.join('\n') : 'sin problemas estructurales')
console.log(`\n${informe.length} capturas en ${SALIDA}`)
