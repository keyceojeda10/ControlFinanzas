// scripts/video-demo/montar-video.mjs
//
// El montaje de una TOMA: coge el .webm que soltó Playwright, le anima los
// acercamientos y le pega los rótulos encima.
//
// ── UNA TOMA POR PANTALLA ──────────────────────────────────────────────────
//
// Lo pidió el dueño después de ver el primero: «lo ideal sería ir grabando por
// pantalla y luego pegarlo, para que si te equivocas en una pantalla la puedas
// rehacer solo esa y no te toque rehacer todo el vídeo». Tiene razón, y además
// es como se monta vídeo de verdad.
//
// Cada toma sale a su propio `.mp4` y `pegar()` las une al final.
//
// ── EL ZOOM SE ANIMA ───────────────────────────────────────────────────────
//
// La primera versión recortaba con `crop` a tamaño fijo y el acercamiento
// entraba de golpe: «la animación de zoom es muy a golpe, no hay animación como
// tal». `crop` no sirve —ffmpeg exige que el recorte sea de tamaño constante—
// pero `zoompan` sí acepta una escala que cambia por fotograma, usando `on`
// como número de fotograma de salida.

import { execFileSync } from 'child_process'
import { existsSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'

const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' })

export function duracion(fichero) {
  return Number(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichero,
  ]).toString().trim())
}

/** Cuánto se puede acercar sin dejar el detalle sin contexto alrededor. */
function escalaSegura(caja, ancho, alto, pedida) {
  /* ⚠ El aire NO puede ser fijo: con 28px, acercarse al selector de país —104px
     de ancho— dejaba fuera el título de la pantalla y se veía una bandera
     enorme y nada más. */
  const aireX = Math.max(150, caja.w * 0.35)
  const aireY = Math.max(150, caja.h * 0.35)
  return Math.max(1.05, Math.min(pedida, ancho / (caja.w + aireX * 2), alto / (caja.h + aireY * 2)))
}

/**
 * Monta UNA toma.
 *
 * @param zooms   [{ t, dura, escala, x, y, w, h }] instante y caja EN EL VÍDEO GRABADO
 * @param rotulos [{ t, dura, fichero, alto }] los PNG que dibuja `rotulos.mjs`
 */
export function montarToma({
  entrada, salida, zooms = [], rotulos = [], desde = 0,
  ancho = 540, alto = 960, salidaAncho = 1080, salidaAlto = 1920, fps = 30,
}) {
  const k = salidaAncho / ancho
  const RAMPA = 0.55 // segundos de entrada y de salida del acercamiento

  /* ⚠ DOS ACERCAMIENTOS PEGADOS SE VEN COMO UN TIRÓN. Reportado al ver el
     vídeo 2: «a veces se ve que mete como un zoom y después otro zoom y es como
     excesivo». Entre el final de uno y el principio del siguiente tiene que
     haber vista normal, o la cámara parece que salta.

     No se corrige en silencio: se avisa, porque lo que hay que arreglar es el
     guion de la toma, no el montaje. */
  const orden = [...zooms].sort((a, b) => a.t - b.t)
  for (let i = 1; i < orden.length; i++) {
    const finAnterior = orden[i - 1].t + orden[i - 1].dura + RAMPA
    const hueco = orden[i].t - finAnterior
    if (hueco < 1.2) {
      console.warn(
        `   ⚠ dos acercamientos a ${hueco.toFixed(1)}s uno de otro ` +
        `(${orden[i - 1].t.toFixed(1)}s y ${orden[i].t.toFixed(1)}s). ` +
        'Separa las paradas de esa toma: se ve como un tirón.',
      )
    }
  }

  // ── El zoom, como una escala que depende del tiempo ──────────────────────
  // `on/fps` es el segundo de salida; se compone un trapecio por acercamiento.
  const trozos = zooms.map((z) => {
    const e = escalaSegura(z, ancho, alto, z.escala)
    const sube = `min(1,max(0,(on/${fps}-${z.t})/${RAMPA}))`
    const baja = `min(1,max(0,(${(z.t + z.dura + RAMPA).toFixed(2)}-on/${fps})/${RAMPA}))`
    return `(${(e - 1).toFixed(4)})*min(${sube},${baja})`
  })
  const zExpr = trozos.length ? `1+${trozos.join('+')}` : '1'

  // El centro salta a la caja del acercamiento activo; entre medias, el centro
  // del cuadro. En coordenadas del vídeo YA escalado a la salida.
  let cxExpr = '(iw/2)', cyExpr = '(ih/2)'
  for (const z of zooms) {
    const cx = ((z.x + z.w / 2) * k).toFixed(1)
    const cy = ((z.y + z.h / 2) * k).toFixed(1)
    const d0 = (z.t - RAMPA).toFixed(2), d1 = (z.t + z.dura + RAMPA).toFixed(2)
    cxExpr = `if(between(on/${fps},${d0},${d1}),${cx},${cxExpr})`
    cyExpr = `if(between(on/${fps},${d0},${d1}),${cy},${cyExpr})`
  }

  // Primero a la resolución de salida: el zoom trabaja sobre la imagen grande y
  // así no se ven los píxeles al acercarse.
  const base =
    `scale=${salidaAncho}:${salidaAlto}:flags=lanczos,` +
    `zoompan=z='${zExpr}':x='max(0,min(iw-iw/zoom,(${cxExpr})-(iw/zoom)/2))':` +
    `y='max(0,min(ih-ih/zoom,(${cyExpr})-(ih/zoom)/2))':d=1:s=${salidaAncho}x${salidaAlto}:fps=${fps}`

  // ── Los rótulos, encima y con la imagen ya recortada ─────────────────────
  const entradas = ['-i', entrada]
  const cadena = []
  let etiqueta = '[base]'
  cadena.push(`[0:v]${base}[base]`)

  rotulos.forEach((r, i) => {
    entradas.push('-i', r.fichero)
    // Altura fija para TODOS: era la otra queja —«se desencuadra un poco a la
    // izquierda, a la derecha, arriba o abajo»—.
    // 280 y no 210: a 210 el rótulo rozaba el botón de «Continuar».
    const y = salidaAlto - r.alto - 280
    const sig = i === rotulos.length - 1 ? '[out]' : `[v${i}]`
    cadena.push(
      `${etiqueta}[${i + 1}:v]overlay=x=(W-w)/2:y=${y}:` +
      `enable='between(t,${r.t},${(r.t + r.dura).toFixed(2)})'${sig}`,
    )
    etiqueta = sig
  })
  if (!rotulos.length) cadena[0] = `[0:v]${base}[out]`

  /* ⚠ `desde` RECORTA EL PRÓLOGO. Cada toma tiene que llevarse sola hasta su
     pantalla —el asistente de registro no conserva el paso al abrir un contexto
     nuevo, así que la toma 4 no encontraba su selector— y ese camino se graba
     igual. Se corta aquí, y por eso los tiempos de rótulos y acercamientos se
     cuentan desde `empezar()`, no desde el principio del archivo. */
  ff([
    ...(desde > 0 ? ['-ss', String(desde)] : []),
    ...entradas,
    '-filter_complex', cadena.join(';'),
    '-map', '[out]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p',
    salida,
  ])
  return salida
}

/**
 * Pega las tomas en el orden dado.
 *
 * ⚠ RUTAS ABSOLUTAS, SIEMPRE. La lista de `concat` vive en /tmp y ffmpeg
 * resuelve lo que hay dentro CONTRA LA CARPETA DE LA LISTA, no contra el
 * directorio de trabajo. Con `scripts/video-demo/tomas/...` iba a buscar
 * `/tmp/scripts/video-demo/tomas/...` y moría con «No such file or directory»
 * después de haber grabado bien la toma — el error sale al final y parece del
 * guion, cuando es de aquí.
 */
export function pegar(tomas, salida) {
  const lista = '/tmp/cf-tomas.txt'
  mkdirSync(dirname(resolve(salida)), { recursive: true })
  writeFileSync(lista, tomas.map((t) => `file '${resolve(t)}'`).join('\n'))
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', salida])
  return salida
}

/** El .webm más reciente de una carpeta (Playwright los nombra con un hash). */
export function ultimoWebm(dir) {
  if (!existsSync(dir)) throw new Error(`no existe ${dir}`)
  const v = readdirSync(dir).filter((f) => f.endsWith('.webm')).sort()
  if (!v.length) throw new Error(`no hay .webm en ${dir}`)
  return `${dir}/${v[v.length - 1]}`
}

export function vaciar(dir) {
  rmSync(dir, { recursive: true, force: true })
  mkdirSync(dir, { recursive: true })
}
