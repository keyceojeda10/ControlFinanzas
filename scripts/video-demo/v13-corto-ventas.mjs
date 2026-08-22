// scripts/video-demo/v13-corto-ventas.mjs
//
// VÍDEO 13 · El corto de ventas, 90 segundos
//
//     node scripts/video-demo/v13-corto-ventas.mjs
//
// NO SE GRABA NADA NUEVO. Se recorta de los doce tutoriales ya hechos, que es
// lo que el dueño pidió: «¿por qué no creas el corto tú, que sabes cuáles son
// los pedazos que vas a usar de cada vídeo?».
//
// ── LOS TROZOS SON DE TRAMOS SIN RÓTULO ────────────────────────────────────
//
// Los tutoriales llevan los carteles QUEMADOS en la imagen. En el corto
// estorban —hablan de otra cosa y se pisarían con la voz nueva—, así que cada
// pedazo sale de un tramo donde no hay ninguno. Los tramos NO se adivinan: los
// encuentra `tramos-limpios.mjs` midiendo el brillo de la franja del rótulo.
//
//     node scripts/video-demo/tramos-limpios.mjs /tmp/videos/09-cobrar-el-dia.mp4 6
//
// ── EL ORDEN CUENTA UNA HISTORIA ───────────────────────────────────────────
//
//   1-3   lo que cuesta trabajo hoy: apuntar el préstamo y sacar la cuenta
//   4-6   el día resuelto: la ruta, cobrar, y que te lleve él
//   7     lo que el cliente recibe
//   8-9   la noche: la caja cuadra y sabes dónde está tu plata
//   10    la llamada: catorce días, sin tarjeta
//
// Si se rehace algún tutorial, hay que volver a mirar sus tramos: los segundos
// de aquí abajo son de ESTA versión.

import { execFileSync } from 'child_process'
import { mkdirSync, writeFileSync, readdirSync, rmSync } from 'fs'
import { resolve } from 'path'

const V = '/tmp/videos'
/* ⚠ CADA TROZO ENTRA MEDIO SEGUNDO DENTRO DEL TRAMO LIMPIO, por los dos lados.
   Cuadrar el corte con el borde exacto del tramo mete el rótulo del vecino, y
   eso NO se ve leyendo esta tabla: se me colaron cuatro así. El repaso de abajo
   los caza, pero es más barato no meterlos. */
const TROZOS = [
  // [vídeo, desde, cuánto, qué se ve]
  ['09-cobrar-el-dia',  29.8,  7.2, 'La lista del día: a quién le toca y cuánto'],
  ['05-prestamo',      194.3,  3.2, 'El préstamo con la cuenta ya hecha'],
  ['06-modos-interes', 227.8,  5.2, 'El ayudante: dos preguntas y te dice tu modo'],
  ['06-modos-interes', 256.3,  7.0, '«Usar siempre este modo»'],
  ['07-rutas',         147.8,  5.2, 'Las rutas que se arman solas por barrio'],
  ['09-cobrar-el-dia', 113.3, 10.2, 'Cobrar en dos toques'],
  ['09-cobrar-el-dia', 205.8,  8.2, '«Empezar ruta»: te abre uno tras otro'],
  ['05-prestamo',      207.3,  3.7, 'El mensaje que le llega al cliente'],
  ['11-caja',           60.3,  7.2, 'La caja del día: lo que te queda en la mano'],
  ['11-caja',          207.3,  5.7, 'El cuadre: quién ya entregó y cuánto'],
  ['12-capital',        35.3,  7.7, 'Toda tu plata: la que tienes y la que está afuera'],
  ['07-rutas',         187.3,  6.7, 'La ruta entera: su cartera y su recorrido'],
  ['01-registro',       99.8,  2.7, 'Crear la cuenta: catorce días, sin tarjeta'],
]

const dir = `${V}/13-corto`
rmSync(dir, { recursive: true, force: true })
mkdirSync(dir, { recursive: true })

const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' })

console.log('· recortando…')
TROZOS.forEach(([video, desde, dura, que], i) => {
  const salida = `${dir}/${String(i).padStart(2, '0')}.mp4`
  /* `-ss` ANTES de `-i` es rápido pero salta al fotograma clave más cercano;
     después de `-i` es exacto. Aquí importa la exactitud: medio segundo de más
     mete el rótulo del tramo de al lado. */
  ff(['-i', `${V}/${video}.mp4`, '-ss', String(desde), '-t', String(dura),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
      '-r', '30', '-an', salida])
  console.log(`  ${String(i + 1).padStart(2)}. ${video} ${desde}s +${dura}s — ${que}`)
})

const piezas = readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort()
writeFileSync('/tmp/cf-corto.txt', piezas.map((f) => `file '${resolve(dir, f)}'`).join('\n'))
ff(['-f', 'concat', '-safe', '0', '-i', '/tmp/cf-corto.txt', '-c', 'copy',
    '-movflags', '+faststart', `${V}/13-corto-ventas.mp4`])

const dur = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
  '-of', 'csv=p=0', `${V}/13-corto-ventas.mp4`]).toString().trim())
console.log(`\n✓ ${V}/13-corto-ventas.mp4 · ${dur.toFixed(1)}s · caben ~${Math.floor(dur * 2.4)} palabras`)

/* ⚠ Y SE COMPRUEBA EL RESULTADO, no la intención. Pasarse medio segundo del
   tramo limpio mete el rótulo del vecino, y eso no se ve leyendo la tabla de
   arriba: se me colaron dos así. Se vuelve a medir el corto ya montado y se
   avisa de cada franja oscura para mirarla. Alguna es legítima —el bloque
   oscuro del monto—, por eso avisa en vez de fallar. */
console.log('\n· repasando el corto en busca de rótulos…')
const repaso = execFileSync('sh', ['-c',
  // ⚠ ENTRE COMILLAS: la carpeta del proyecto lleva un espacio («Control
  //   Finanzas») y sin ellas `sh -c` parte la ruta en dos.
  `node "${resolve('scripts/video-demo/tramos-limpios.mjs')}" "${V}/13-corto-ventas.mp4" 0.5 2>/dev/null`],
  { encoding: 'utf8', maxBuffer: 1 << 26 })
const limpios = [...repaso.matchAll(/limpio\s+([\d.]+)s →\s+([\d.]+)s/g)].map((m) => [+m[1], +m[2]])
const huecos = []
let cursor = 0
for (const [a, b] of limpios) { if (a - cursor > 0.4) huecos.push([cursor, a]); cursor = b }
if (dur - cursor > 0.4) huecos.push([cursor, dur])
if (!huecos.length) console.log('  sin franjas oscuras: ningún rótulo')
else for (const [a, b] of huecos) console.log(`  ⚠ mirar ${a.toFixed(1)}s → ${b.toFixed(1)}s`)
