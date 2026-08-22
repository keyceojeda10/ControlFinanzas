// scripts/video-demo/tramos-limpios.mjs
//
// Dice en qué segundos de un vídeo NO hay rótulo en pantalla.
//
//     node scripts/video-demo/tramos-limpios.mjs /tmp/videos/09-cobrar-el-dia.mp4 8
//
// ── POR QUÉ ────────────────────────────────────────────────────────────────
//
// Los tutoriales llevan los rótulos QUEMADOS en la imagen: son la guía de la
// narración y ahí sirven. En el corto de ventas estorban —hablan de otra cosa y
// se pisan con la voz nueva—, así que los trozos se recortan de los tramos
// donde no hay ninguno.
//
// Se detecta mirando la imagen, no adivinando: el rótulo es una banda NEGRA a
// una altura fija (el montaje la pone siempre en el mismo sitio), así que se
// recorta esa franja y se mide su brillo segundo a segundo. Oscuro = hay
// cartel; claro = la página, que es casi blanca.
import { execFileSync } from 'child_process'

const [fichero, minimo = '6'] = process.argv.slice(2)
if (!fichero) { console.error('uso: tramos-limpios.mjs <vídeo.mp4> [segundos mínimos]'); process.exit(1) }

/* ⚠ LA FRANJA, AJUSTADA AL CARTEL. `montar-video.mjs` lo pega a
   `alto - alto_del_rótulo - 280`: en 1920 va de 1490 a 1640, según tenga uno o
   dos renglones.

   La primera versión medía 230px de alto y el promedio NO bajaba lo suficiente
   —el cartel solo ocupaba un cuarto de la franja, así que la media se quedaba
   en 200 y pasaba por «limpio»—. El corto salió con un rótulo en el primer
   trozo. Ajustada al alto real, con cartel la media cae por debajo de 100. */
/* ⚠ `signalstats` escribe por el canal de ERRORES, no por la salida: pidiendo
   `stdout` volvía `null` y el guion reventaba en el `.split`. */
let salida = ''
try {
  execFileSync('ffmpeg', [
    '-i', fichero,
    '-vf', 'crop=1080:145:0:1495,fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG',
    '-f', 'null', '-',
  ], { encoding: 'utf8', maxBuffer: 1 << 28 })
} catch (e) {
  salida = String(e.stderr ?? '')
}
if (!salida) {
  salida = execFileSync('sh', ['-c',
    `ffmpeg -i "${fichero}" -vf "crop=1080:145:0:1495,fps=2,signalstats,metadata=print:key=lavfi.signalstats.YAVG" -f null - 2>&1`],
    { encoding: 'utf8', maxBuffer: 1 << 28 })
}

const brillos = []
for (const l of salida.split('\n')) {
  const m = l.match(/lavfi\.signalstats\.YAVG=([\d.]+)/)
  if (m) brillos.push(Number(m[1]))
}
/* Con el cartel puesto la media cae por debajo de 100; sin él, la página ronda
   240. 170 deja margen para pantallas oscuras (el bloque del monto) sin dar por
   sucio un tramo bueno. */
const limpio = brillos.map((y) => y > 170)

const tramos = []
let desde = null
limpio.forEach((ok, i) => {
  const t = i / 2
  if (ok && desde === null) desde = t
  if (!ok && desde !== null) { tramos.push([desde, t]); desde = null }
})
if (desde !== null) tramos.push([desde, limpio.length / 2])

const buenos = tramos.filter(([a, b]) => b - a >= Number(minimo))
console.log(`${fichero}  ·  ${brillos.length / 2}s`)
for (const [a, b] of buenos) {
  console.log(`  limpio ${String(a.toFixed(1)).padStart(6)}s → ${String(b.toFixed(1)).padStart(6)}s   (${(b - a).toFixed(1)}s)`)
}
if (!buenos.length) console.log('  (ningún tramo limpio de esa duración)')
