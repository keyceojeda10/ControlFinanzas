// ¿QUE CIFRAS ENTREGA UNA PANTALLA QUE NADIE PINTA?
//
// ── Para que sirve ────────────────────────────────────────────────────────
//
// Una API que devuelve cifras que la pantalla no usa es trabajo de servidor
// tirado, y peor: son numeros que alguien calculo, que parecen disponibles y
// que nadie ha comprobado nunca porque no se ven. En el panel ya hay un caso
// documentado —`hoy.ganancia` y la narrativa que `Panel.jsx` no consume— y la
// pregunta merece herramienta, no una lectura a ojo.
//
// Tambien contesta lo contrario: cifras que la UI lee y la API no manda, que
// salen en pantalla como `undefined` o como un hueco.
//
// Es un analisis de TEXTO, no de tipos: si una clave se menciona en cualquier
// parte del archivo, cuenta como usada. Prefiere el falso «esta viva» al falso
// «esta muerta» — borrar algo que si se usaba es mucho peor que dejar de mas.
//
//   node scripts/cifras-muertas.mjs panel
//   node scripts/cifras-muertas.mjs caja

import fs from 'fs'

const PANTALLAS = {
  panel: {
    api: 'app/api/dashboard/resumen/route.js',
    ui: [
      'app/(dashboard)/dashboard/page.jsx',
      'lib/adaptadores/panel.js',
      'components/pantallas/Panel.jsx',
      'components/dashboard/DashboardAiTip.jsx',
      'lib/adaptadores/narrativa.js',
    ],
  },
  caja: {
    api: 'app/api/caja/route.js',
    ui: ['app/(dashboard)/caja/page.jsx', 'components/pantallas/Caja.jsx', 'lib/adaptadores/cuadre.js'],
  },
  reportes: {
    api: 'app/api/reportes/resumen/route.js',
    ui: ['app/(dashboard)/reportes/page.jsx', 'components/pantallas/Reportes.jsx'],
  },
  ruta: {
    api: 'app/api/rutas/[id]/route.js',
    ui: ['app/(dashboard)/rutas/[id]/page.jsx', 'lib/adaptadores/ruta.js'],
  },
}

const cual = process.argv[2] || 'panel'
const cfg = PANTALLAS[cual]
if (!cfg) throw new Error(`No conozco "${cual}". Hay: ${Object.keys(PANTALLAS).join(', ')}`)

const leer = (f) => { try { return fs.readFileSync(f, 'utf8') } catch { return null } }

const api = leer(cfg.api)
if (api == null) throw new Error(`No pude leer ${cfg.api}`)

// Las claves del objeto que se devuelve. Se busca desde el ultimo `json({`
// hasta el final: es donde vive la respuesta.
const i = Math.max(api.lastIndexOf('NextResponse.json({'), api.lastIndexOf('Response.json({'))
if (i < 0) throw new Error('No encontre el objeto de respuesta')
const cuerpo = api.slice(i)
const claves = [...new Set([...cuerpo.matchAll(/^\s{2,10}([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map((m) => m[1]))]

const faltantes = []
const fuentes = []
for (const f of cfg.ui) {
  const s = leer(f)
  if (s == null) { faltantes.push(f); continue }
  fuentes.push(s)
}
if (faltantes.length) {
  console.log(`\n⚠ no pude leer: ${faltantes.join(', ')}\n`)
}
const ui = fuentes.join('\n')

// Ruido: claves genericas que aparecen en cualquier sitio y no dicen nada.
const RUIDO = new Set(['id', 'total', 'cantidad', 'lista', 'monto', 'fecha', 'tipo', 'nombre', 'headers', 'cliente', 'activos'])

const muertas = [], vivas = [], ruido = []
for (const k of claves) {
  if (RUIDO.has(k)) { ruido.push(k); continue }
  ;(new RegExp(`\\b${k}\\b`).test(ui) ? vivas : muertas).push(k)
}

console.log(`\n══ ${cual.toUpperCase()} · ${cfg.api} ══\n`)
console.log(`   claves que devuelve ......... ${claves.length}`)
console.log(`   la pantalla las menciona .... ${vivas.length}`)
console.log(`   NADIE las menciona .......... ${muertas.length}`)
console.log(`   demasiado genericas ......... ${ruido.length}  (${ruido.join(', ')})`)

if (muertas.length) {
  console.log(`\n   ── cifras que se calculan y no se pintan ──`)
  for (const k of muertas) console.log(`      ${k}`)
}
console.log('')
