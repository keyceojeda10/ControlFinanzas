// scripts/barrer-rutas.mjs — abre TODAS las rutas y dice cuáles revientan.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// En una sola noche esto encontró dos pantallas muertas que la suite no vio:
//
//   · «Importar Excel» no abría — `Cannot access 'handleVolver' before
//     initialization`. Uno de los tres caminos de la pantalla de activación.
//   · Un error de sintaxis mío al resolver un merge tumbó el BUILD ENTERO, y
//     con él todas las pantallas. `/reportes` salía en blanco.
//
// Las 1.661 pruebas estaban en verde en los dos casos. Vitest no compila las
// rutas de la app: un archivo que ni siquiera parsea pasa la suite sin
// despeinarse. Verde no significa que la app abra.
//
// ══ CÓMO SE USA ════════════════════════════════════════════════════════════
//
//   node scripts/ids-demo.mjs           → los ids reales de la cartera de prueba
//   node scripts/barrer-rutas.mjs        → las rutas fijas
//   node scripts/barrer-rutas.mjs cl_x rt_y us_z   → también las de detalle
//
// Saca el mensaje REAL del DOM —el `<pre>` de «detalles técnicos»— en vez del
// «no pudimos cargar esta sección», que no dice nada.

import { chromium } from 'playwright'
import fs from 'node:fs'

// ── LOS IDS SE BUSCAN SOLOS ──
//
// Antes habia que pasarlos a mano, y sin ellos el barrido se saltaba TODAS las
// rutas de detalle. Asi se colo durante semanas un error mortal en
// `/caja/cobrador/[id]` —«Cannot access 'data' before initialization»— que en
// produccion salia minificado como «Cannot access 'O'» y reventaba la pantalla
// entera. El barrido decia «las 32 abren» y era verdad: nunca abrio la 33.
//
// Ahora, si no se pasan por argumento, se piden a la base local. Un barrido que
// solo mira lo facil da una confianza que no ha ganado.
let [cliente, ruta, cobrador] = process.argv.slice(2)
if (!cliente || !ruta || !cobrador) {
  try {
    const { execFileSync } = await import('node:child_process')
    const salida = execFileSync(process.execPath, ['scripts/ids-demo.mjs'], { encoding: 'utf8' })
    // La ultima linea es el JSON: `ids-demo.mjs` puede imprimir avisos antes.
    const trozos = salida.trim().split(String.fromCharCode(10))
    const ids = JSON.parse(trozos[trozos.length - 1])
    cliente = cliente || ids.cliente
    ruta = ruta || ids.ruta
    cobrador = cobrador || ids.cobrador
    console.log(`ids de la base: cliente=${cliente ?? '—'} ruta=${ruta ?? '—'} cobrador=${cobrador ?? '—'}`)
  } catch {
    console.log('AVISO: sin ids, las rutas de detalle NO se prueban.')
  }
}

const RUTAS = [
  '/dashboard', '/cobros-hoy', '/rutas', '/prestamos', '/clientes', '/caja',
  '/capital', '/gastos', '/reportes', '/dashboard/analiticas', '/mis-estadisticas',
  '/lineas-credito', '/lineas-credito/nueva', '/socios', '/socios/nuevo',
  '/cobradores', '/cobradores/nuevo', '/cobradores/ranking',
  '/clientes/nuevo', '/prestamos/nuevo', '/prestamos/simulador',
  '/migrador', '/carga-masiva', '/clavos', '/actividad', '/tutoriales',
  '/asistente', '/soporte', '/soporte/nuevo', '/configuracion',
  '/configuracion/plan', '/mas',
  ...(cliente ? [`/clientes/${cliente}`, `/clientes/${cliente}/editar`, `/clientes/${cliente}/historial`] : []),
  ...(ruta ? [`/rutas/${ruta}`, `/qr/${ruta}`] : []),
  ...(cobrador ? [`/cobradores/${cobrador}`, `/caja/cobrador/${cobrador}`] : []),
]

const { cookie } = JSON.parse(fs.readFileSync('.auditoria/sesion.json', 'utf8'))
const nav = await chromium.launch()
const ctx = await nav.newContext({
  viewport: { width: 1440, height: 900 },
  storageState: {
    cookies: [cookie],
    origins: [{ origin: 'http://localhost:3000', localStorage: [
      { name: 'cf-theme', value: 'light' },
      // El aviso de novedades tapa la pantalla y se come los clics.
      { name: 'cf:novedades:visto', value: '99' },
    ] }],
  },
})

const rotas = []
for (const r of RUTAS) {
  const p = await ctx.newPage()
  const sintaxis = []
  p.on('console', (m) => {
    // Un error de sintaxis tumba el build entero, no solo su ruta: sale en la
    // consola de CUALQUIER pantalla que se cargue despues.
    if (m.type() === 'error' && /Expected|Unexpected|SyntaxError/.test(m.text())) sintaxis.push(m.text().slice(0, 120))
  })
  try {
    await p.goto(`http://localhost:3000${r}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    await p.waitForTimeout(6000)
    const err = await p.evaluate(() => {
      const d = document.querySelector('details')
      if (d) d.open = true
      return document.querySelector('details pre')?.innerText ?? null
    })
    const vacia = await p.evaluate(() => document.body.innerText.replace(/\s+/g, '').length < 120)
    if (err) { rotas.push(`${r} → ${err.split('\n')[0]}`); console.log(`✗ ${r} → ${err.split('\n')[0]}`) }
    else if (vacia) { rotas.push(`${r} → EN BLANCO`); console.log(`✗ ${r} → EN BLANCO`) }
    else if (sintaxis.length) { rotas.push(`${r} → ${sintaxis[0]}`); console.log(`✗ ${r} → ${sintaxis[0]}`) }
    else console.log(`· ${r}`)
  } catch (e) {
    rotas.push(`${r} → ${e.message.split('\n')[0]}`)
    console.log(`✗ ${r} → ${e.message.split('\n')[0]}`)
  }
  await p.close()
}

console.log(rotas.length ? `\n${rotas.length} ROTAS:\n${rotas.join('\n')}` : `\nlas ${RUTAS.length} abren`)
await nav.close()
process.exit(rotas.length ? 1 : 0)
