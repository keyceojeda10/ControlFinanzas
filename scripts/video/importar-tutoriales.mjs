#!/usr/bin/env node
/* ══ LOS VIDEOS DEL PROFE: DEL CATÁLOGO DEL AGENTE A LA APP ══════════════════
 *
 * El agente de los videos (BotAdsManager) entrega `tutoriales-catalogo.json`
 * con los 45 videos: dónde va cada uno, sus capítulos, quién los ve. Esto:
 *
 *   1. copia el catálogo a `lib/tutoriales/catalogo.json`, con `src` y
 *      `poster` (lo que la app pide al navegador) además de lo que traía;
 *   2. copia cada video y su portada a `public/videos/profe/<serie>/` en
 *      ESTA máquina (la carpeta está en .gitignore: no entra al repo);
 *   3. dice cuánto pesan y si falta algo.
 *
 * ⚠ LOS VIDEOS NO VAN EN GIT (decisión del 19 oct 2026). Son ~190 MB y en
 * `public/` entrarían a cada clonado y quedarían en la historia para siempre,
 * con cada re-edición sumando más. En el VPS viven en `/home/cf-videos/profe/`
 * y `public/videos/profe` es un enlace a esa carpeta (el despliegue solo hace
 * `git pull`: no toca lo que está fuera de git). Para subirlos:
 *
 *   rsync -av --delete public/videos/profe/ root@69.62.87.141:/home/cf-videos/profe/
 *
 * La bienvenida (`estado: montado`) ya está en git en `public/videos/` y se
 * deja donde está.
 *
 * Uso:  node scripts/video/importar-tutoriales.mjs [ruta/al/tutoriales-catalogo.json]
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const ORIGEN = process.argv[2] || path.join(process.env.HOME, 'Documents/BotAdsManager/para-agente-cf/tutoriales-catalogo.json')
const DESTINO_JSON = path.join(RAIZ, 'lib/tutoriales/catalogo.json')
const CARPETA = path.join(RAIZ, 'public/videos/profe')

const cat = JSON.parse(fs.readFileSync(ORIGEN, 'utf8'))
const videos = []
let bytes = 0
const faltan = []
for (const v of cat.videos) {
  if (v.estado === 'montado') {
    // Ya está en la app (la bienvenida): se respeta su `destino`.
    const { origen, portada, ...resto } = v
    videos.push({ ...resto, src: v.destino, poster: v.destino.replace(/-720\.mp4$/, '-portada.jpg') })
    continue
  }
  // «/videos/rutas/recorrido.mp4» → «/videos/profe/rutas/recorrido.mp4»
  const rel = v.destino.replace(/^\/videos\//, '')
  const src = `/videos/profe/${rel}`
  const poster = src.replace(/\.mp4$/, '.jpg')
  const destMp4 = path.join(CARPETA, rel)
  const destJpg = destMp4.replace(/\.mp4$/, '.jpg')
  fs.mkdirSync(path.dirname(destMp4), { recursive: true })
  for (const [de, a] of [[v.origen, destMp4], [v.portada, destJpg]]) {
    if (!de || !fs.existsSync(de)) { faltan.push(`${v.id}: ${de}`); continue }
    const nuevo = !fs.existsSync(a) || fs.statSync(a).size !== fs.statSync(de).size || fs.statSync(a).mtimeMs < fs.statSync(de).mtimeMs
    if (nuevo) fs.copyFileSync(de, a)
  }
  if (fs.existsSync(destMp4)) bytes += fs.statSync(destMp4).size
  // `origen` y `portada` son rutas de la máquina del agente: no viajan a la app.
  const { origen, portada, ...resto } = v
  videos.push({ ...resto, src, poster })
}

fs.writeFileSync(DESTINO_JSON, JSON.stringify({ actualizado: cat.actualizado, videos }, null, 1) + '\n')
const porEstado = videos.reduce((a, v) => ({ ...a, [v.estado]: (a[v.estado] ?? 0) + 1 }), {})
console.log(`${videos.length} videos · ${JSON.stringify(porEstado)} · ${(bytes / 1e6).toFixed(1)} MB en ${path.relative(RAIZ, CARPETA)}`)
console.log(`catálogo → ${path.relative(RAIZ, DESTINO_JSON)}`)
if (faltan.length) { console.log(`FALTAN ${faltan.length}:\n  ${faltan.join('\n  ')}`); process.exitCode = 1 }
