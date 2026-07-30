// scripts/recorrer.mjs — captura la app logueada, pantalla por pantalla.
//
// EL PUNTO CIEGO QUE ESTO CIERRA: verificar componentes sueltos en un banco de
// pruebas no detecta lo que falla al integrarlos. Tres barras de navegación
// solapadas en escritorio son invisibles en un marco de 390px, y así llegaron
// hasta el navegador del dueño.
//
//   node scripts/recorrer.mjs [carpeta] [--solo=rutas,caja]
//   node scripts/recorrer.mjs .auditoria/x --extra=/prestamos/pr_abc/tabla:tabla
//
// `--extra` es para las rutas con id, que no pueden ir en la lista fija porque el
// id cambia con la base. Sin esto ninguna FICHA de prestamo entraba nunca al
// barrido —ni la del cliente, ni la del prestamo, ni la tabla—, o sea que las
// pantallas del bloque 4 se quedaron fuera de la unica herramienta que mira la
// app entera. Formato `ruta:nombre`, separadas por coma.
//
// Además de la imagen, anota lo que una captura NO enseña: errores de consola,
// peticiones caídas, y cuántas cabeceras y barras de navegación hay montadas.

import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const SALIDA = process.argv[2] || '.auditoria/capturas'
const soloArg = process.argv.find((a) => a.startsWith('--solo='))
const solo = soloArg ? soloArg.slice(7).split(',').map((s) => s.trim()) : null
const extraArg = process.argv.find((a) => a.startsWith('--extra='))
const EXTRA = extraArg
  ? extraArg.slice(8).split(',').map((par) => {
      // El id lleva `_`, la ruta lleva `/`: se parte por el ULTIMO `:` para que
      // un nombre con dos puntos no rompa la ruta.
      const i = par.lastIndexOf(':')
      return i < 0 ? { ruta: par, nombre: par.replace(/\W+/g, '-').replace(/^-|-$/g, '') }
                   : { ruta: par.slice(0, i), nombre: par.slice(i + 1) }
    })
  : []

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
  ...EXTRA,
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

  // El indicador de desarrollo de Next —el circulito oscuro con la «N»— se
  // planta abajo a la izquierda y TAPA la interfaz: se comio el avatar del pie
  // de la barra lateral y un trozo de la pastilla en movil. Al cotejar contra
  // una lamina, un elemento tapado es un elemento que no se puede comparar.
  //
  // Se oculta solo en la captura, no en la app: `devIndicators: false` en
  // next.config se lo quitaria tambien al usuario mientras desarrolla.
  await ctx.addInitScript(() => {
    const esconder = () => {
      const css = 'nextjs-portal,[data-nextjs-toast],[data-nextjs-dev-tools-button]{display:none!important}'
      if (document.getElementById('cf-sin-indicador')) return
      const s = document.createElement('style')
      s.id = 'cf-sin-indicador'
      s.textContent = css
      document.head?.appendChild(s)
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', esconder)
    } else esconder()
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
      // 6s, no 3,5. En desarrollo el panel tarda mas: la captura salia con el
      // esqueleto propio de la pantalla y el detector de «CARGANDO todavia»
      // saltaba con razon. Compilar la ruta la primera vez y resolver cuatro
      // peticiones no cabe en tres segundos y medio.
      await pag.waitForTimeout(6000)
      // Sin esto el barrido dispara el limitador de peticiones y los 429 que
      // salen en el informe son mios, no de la app. Con 1,8s el limitador
      // aguanta un barrido de las catorce pantallas seguidas.
      await pag.waitForTimeout(1800)
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
        // Cuánto texto hay. Ver `letras` más abajo: es el detector de páginas
        // en blanco, y sin él el cotejo de cierre se hace contra nada.
        letras: (document.body?.innerText || '').trim().length,
        // Y el detector de ESQUELETOS, que es el caso más frecuente: la página
        // pinta pero los datos no llegaron, así que lo capturado es el estado de
        // carga. Pasó cotejando la tarjeta de cliente: la captura salió con los
        // esqueletos y estuve comparándolos contra las tarjetas de la lámina.
        //
        // Una página en blanco se nota; un esqueleto se parece lo justo a la
        // pantalla real para colarse.
        cargando: document.querySelectorAll('[aria-busy="true"]').length,
        // Y si la app se cree SIN CONEXION. Pasa en desarrollo: el ping de
        // /api/ping tarda o lo tumba el limitador, la app lo lee como «limbo»
        // —WiFi sin paso a internet— y sirve el esqueleto desde cache. Lo
        // capturado entonces no es la pantalla, es el modo offline.
        offline: /sin conexi[oó]n/i.test(document.body?.innerText || ''),
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
  // PRIMERO ESTO, porque invalida todo lo demás: una página vacía tiene 0
  // cabeceras y 0 navs, o sea que las otras comprobaciones no saltan y el
  // script decía «sin problemas estructurales» sobre un PNG blanco.
  //
  // Ya pasó: se me cayó el servidor de desarrollo, capturé, y me puse a comparar
  // una lámina contra una imagen en blanco. Menos de 40 letras no es una
  // pantalla de esta app ni en el estado vacío más pelado.
  if ((r.letras ?? 0) < 40) señales.push(`EN BLANCO (${r.letras ?? 0} letras) ← ¿está caído el servidor?`)
  if (r.cargando > 0) señales.push(`CARGANDO todavía (${r.cargando} esqueleto/s) ← no cotejes esto`)
  if (r.offline) señales.push('la app se cree SIN CONEXIÓN ← el ping se cayó, no cotejes esto')
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
