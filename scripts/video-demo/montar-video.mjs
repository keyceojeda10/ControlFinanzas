// scripts/video-demo/montar-video.mjs
//
// El montaje: coge el .webm que soltó Playwright y le aplica los acercamientos
// que se apuntaron durante la grabación.
//
// ── POR QUÉ EL ZOOM SE HACE AQUÍ Y NO EN LA PÁGINA ─────────────────────────
//
// Un `transform: scale()` sobre el `body` saca de su sitio todo lo que esté en
// `position: fixed` —la pastilla de navegación y el botón flotante— porque un
// ancestro transformado se convierte en su contenedor. Se vería la barra
// flotando en mitad de la pantalla.
//
// ── POR QUÉ POR TRAMOS Y NO CON UNA EXPRESIÓN ──────────────────────────────
//
// El primer intento animaba la escala con `crop=w='iw/(1+...t...)'` y ffmpeg lo
// rechaza: el recorte tiene que ser de TAMAÑO FIJO, solo su posición puede
// variar por fotograma. («Error when evaluating the expression», y no escribe
// nada.)
//
// Así que cada acercamiento es su propio tramo con un recorte constante, y los
// tramos se pegan al final. Además queda mejor: un corte limpio a primer plano
// es lo que hace un tutorial bien montado, no un zoom que repta.

import { execFileSync } from 'child_process'
import { existsSync, readdirSync, writeFileSync, rmSync, mkdirSync } from 'fs'

const ff = (args) => execFileSync('ffmpeg', ['-y', '-v', 'error', ...args], { stdio: 'inherit' })

export function duracion(fichero) {
  const s = execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', fichero,
  ]).toString().trim()
  return Number(s)
}

/**
 * @param marcas  [{ t, dura, escala, x, y, w, h }] en segundos y píxeles del vídeo
 */
/* `ancho`/`alto` son los del vídeo grabado —el espacio en el que vienen las
   coordenadas de las marcas— y `salidaAncho`/`salidaAlto` los del archivo final.
   Se entrega al DOBLE: 540×960 subido a YouTube se ve pastoso, y como la página
   se capturó con `deviceScaleFactor: 2` la nitidez está ahí para aprovecharla. */
export function montar({
  entrada, salida, marcas = [], ancho = 540, alto = 960, fps = 30,
  salidaAncho = 1080, salidaAlto = 1920,
}) {
  const tmp = '/tmp/cf-montaje'
  rmSync(tmp, { recursive: true, force: true })
  mkdirSync(tmp, { recursive: true })

  const fin = duracion(entrada)
  const orden = [...marcas].sort((a, b) => a.t - b.t)

  // Los tramos, en orden: lo normal entre acercamiento y acercamiento.
  const tramos = []
  let cursor = 0
  for (const m of orden) {
    const desde = Math.max(cursor, m.t)
    if (desde > cursor + 0.15) tramos.push({ desde: cursor, hasta: desde, zoom: null })
    const hasta = Math.min(fin, desde + m.dura)
    if (hasta > desde) tramos.push({ desde, hasta, zoom: m })
    cursor = hasta
  }
  if (fin > cursor + 0.15) tramos.push({ desde: cursor, hasta: fin, zoom: null })

  const piezas = []
  tramos.forEach((tr, i) => {
    const pieza = `${tmp}/p${String(i).padStart(2, '0')}.mp4`
    const filtros = []
    if (tr.zoom) {
      /* ⚠ LA ESCALA PEDIDA ES UN MÁXIMO, NO UNA ORDEN. Un botón de 422px de
         ancho con escala 1,9 recorta a 284: más estrecho que el propio botón,
         así que se acerca tanto que lo corta por los lados. Se limita a lo que
         quepa el elemento con aire alrededor. */
      /* ⚠ EL AIRE NO PUEDE SER FIJO. Con 28px alrededor, acercarse al selector
         de país —que mide 104 de ancho— dejaba fuera el título de la pantalla y
         el campo del teléfono: se veía una bandera enorme y nada más. Un
         acercamiento tiene que encuadrar el detalle Y lo justo para saber dónde
         está. El aire crece con el elemento, con un mínimo generoso. */
      const aireX = Math.max(150, tr.zoom.w * 0.35)
      const aireY = Math.max(150, tr.zoom.h * 0.35)
      const e = Math.max(1.05, Math.min(
        tr.zoom.escala,
        ancho / (tr.zoom.w + aireX * 2),
        alto / (tr.zoom.h + aireY * 2),
      ))
      // Ancho y alto PARES: libx264 con yuv420p no acepta impares y aborta.
      const w = Math.floor(ancho / e / 2) * 2
      const h = Math.floor(alto / e / 2) * 2
      const cx = tr.zoom.x + tr.zoom.w / 2
      const cy = tr.zoom.y + tr.zoom.h / 2
      // Y dentro del cuadro: una marca pegada al borde pediría píxeles que no existen.
      const x = Math.round(Math.max(0, Math.min(ancho - w, cx - w / 2)))
      const y = Math.round(Math.max(0, Math.min(alto - h, cy - h / 2)))
      filtros.push(`crop=${w}:${h}:${x}:${y}`)
    }
    filtros.push(`scale=${salidaAncho}:${salidaAlto}:flags=lanczos`, `fps=${fps}`, 'format=yuv420p')
    ff([
      '-ss', String(tr.desde), '-to', String(tr.hasta), '-i', entrada,
      '-vf', filtros.join(','),
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', pieza,
    ])
    piezas.push(pieza)
  })

  const lista = `${tmp}/lista.txt`
  writeFileSync(lista, piezas.map((p) => `file '${p}'`).join('\n'))
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', salida])
  return salida
}

/** El .webm más reciente de una carpeta (Playwright los nombra con un hash). */
export function ultimoWebm(dir) {
  if (!existsSync(dir)) throw new Error(`no existe ${dir}`)
  const v = readdirSync(dir).filter((f) => f.endsWith('.webm'))
  if (!v.length) throw new Error(`no hay .webm en ${dir}`)
  return `${dir}/${v[v.length - 1]}`
}
