// scripts/video-demo/subtitulos.mjs
//
// LOS SUBTÍTULOS, CLAVADOS Y SIN LA CAJA NEGRA
//
//     node scripts/video-demo/subtitulos.mjs 14-clientes            # .srt + .ass
//     node scripts/video-demo/subtitulos.mjs 14-clientes --quemar   # y los graba encima
//     node scripts/video-demo/subtitulos.mjs 14-clientes --toma 1
//
// ── POR QUÉ SE REHACEN ─────────────────────────────────────────────────────
//
// El dueño: «lo que no me gustó de los otros vídeos es el detalle de los
// subtítulos. No me gustaron del todo, no sé por qué.»
//
// El porqué se ve poniéndolos al lado. Los viejos NO eran subtítulos: eran
// rótulos —un resumen escrito aparte, en 40px semibold, dentro de una caja
// negra opaca de dos líneas, flotando a 280px del borde—. Tres cosas que
// chirrían:
//
//   1. **No decían lo que se oye.** Se escribieron como pies de foto, no como
//      transcripción. Con voz encima, leer una cosa y oír otra cansa.
//   2. **La caja negra opaca** se come un quinto de la pantalla y no deja ver
//      justo lo que se está explicando.
//   3. **Flotaban.** A 280px del borde no están ni abajo ni en medio.
//
// Los nuevos son subtítulos de verdad: **las palabras exactas que se dicen**,
// al segundo en que se dicen —ElevenLabs devuelve el instante de CADA LETRA—,
// abajo donde se esperan, sin caja, con contorno y sombra para que se lean
// sobre cualquier fondo.
//
// ── SE ENTREGAN DE LAS DOS FORMAS ──────────────────────────────────────────
//
//  · `.srt` — para subirlo aparte a YouTube o arrastrarlo al editor. El vídeo
//    se queda limpio y los subtítulos se pueden apagar.
//  · `.ass` — el mismo texto con el estilo ya puesto, para quemarlo con
//    `--quemar` cuando se quiera el vídeo listo sin tocar nada.
//
// ⚠ QUEMAR ES IRREVERSIBLE. Por eso el fichero limpio no se toca nunca: el
//   quemado sale aparte, como `.sub.mp4`.

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { dirname, basename } from 'path'

const VIDEOS = '/home/keyce/Desktop/videos-tutoriales'

/* ── EL ESTILO ──────────────────────────────────────────────────────────────
   Vertical 1080×1920. Los números salen de mirarlo en el móvil, no de copiar
   un preset: 46px es lo que se lee a un brazo de distancia sin comerse la
   pantalla, y el margen de 210 lo deja por encima de la barra de navegación de
   la aplicación, que vive abajo del todo y es lo único que no se puede tapar. */
const ESTILO = {
  fuente: 'Inter',
  tamano: 54,
  color: '&H00FFFFFF',
  /* ⚠ SÍ LLEVA PLACA, Y NO ES VOLVER A LA CAJA DE ANTES.
     Empecé sin ella —solo contorno y sombra, que es lo elegante— y sobre esta
     aplicación no se lee: el tema claro deja texto blanco sobre tarjetas
     blancas. Se ve comparando los fotogramas, no razonándolo.
     La diferencia con la caja vieja es lo que ocupa: aquella era una franja de
     dos líneas fijas, siempre igual de grande, tapando un quinto de la
     pantalla. Esta se ciñe al texto —crece y encoge con él— y va abajo, donde
     se esperan los subtítulos, no flotando en medio. */
  contorno: '&H1A0D0F13',   // casi negro, ~90% opaca
  grosorContorno: 22,       // con BorderStyle 3 esto es el relleno de la placa
  sombra: 0,
  margenAbajo: 210,
  margenLados: 90,
  /* ⚠ UNA SOLA LÍNEA POR CORTE, Y NO ES UN CAPRICHO DE ESTILO.
   *
   * El dueño, con la muestra: «las barras del fondo negro se superponen una
   * detrás de la otra, dan un doble tono». Es exacto, y es cómo dibuja libass
   * la placa: **una caja POR LÍNEA**. Con dos líneas salen dos rectángulos
   * traslúcidos que se pisan en el solape y se ve el escalón.
   *
   * Se puede pelear con la opacidad hasta que casi no se note, pero él mismo
   * puso el dedo en lo importante: «en un texto te pueden quedar bien y en otro
   * superpuestas; qué tal que hagamos un vídeo larguísimo y al revisar esté mal
   * el subtítulo en algunas partes». Un arreglo que depende del texto no es un
   * arreglo.
   *
   * Con UNA línea por corte el problema no existe: una línea, una caja. Y
   * `WrapStyle: 2` impide que libass parta ninguna por su cuenta, que sería la
   * puerta de atrás por la que volvería a colarse. */
  anchoLinea: 30,
  maxLineas: 1,
}

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args])

/** hh:mm:ss,mmm */
const srtT = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60), ms = Math.round((s - Math.floor(s)) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
/** h:mm:ss.cc — el de los .ass, que va en centésimas */
const assT = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  const sec = (s % 60).toFixed(2).padStart(5, '0')
  return `${h}:${String(m).padStart(2, '0')}:${sec}`
}

/**
 * Parte un párrafo en trozos que quepan en dos líneas, cortando por donde la
 * frase respira: primero por punto, luego por coma, y solo al final por
 * palabra.
 *
 * ⚠ El corte NO se hace por número de caracteres a secas. Partir «Busca por
 *   nombre o por cédula, y va filtrando mientras / escribes» deja huérfana la
 *   última palabra y se lee peor que dos líneas desiguales.
 */
function trocear(texto) {
  const tope = ESTILO.anchoLinea * ESTILO.maxLineas
  if (texto.length <= tope) return [texto]

  const trozos = []
  let resto = texto
  while (resto.length > tope) {
    const ventana = resto.slice(0, tope + 1)
    let corte = Math.max(ventana.lastIndexOf('. '), ventana.lastIndexOf(': '))
    if (corte < tope * 0.45) corte = ventana.lastIndexOf(', ')
    if (corte < tope * 0.45) corte = ventana.lastIndexOf(' ')
    if (corte <= 0) corte = tope
    trozos.push(resto.slice(0, corte + 1).trim())
    resto = resto.slice(corte + 1).trim()
  }
  if (resto) trozos.push(resto)
  return trozos
}

/* Con una línea por corte no hay nada que partir. Se deja la función por si
   algún día se vuelve a dos —y con el aviso de por qué no—. */
const partirEnLineas = (t) => t

/**
 * Los cortes de una toma, con el segundo exacto de cada uno.
 *
 * Se apoya en las marcas de letra que devolvió ElevenLabs: para cada trozo se
 * busca dónde empieza y dónde acaba SU texto dentro del párrafo, y se leen los
 * tiempos de esas dos letras. Nada se reparte a ojo.
 */
function cortesDe(vozJson) {
  const { parrafos } = JSON.parse(readFileSync(vozJson, 'utf8'))
  const cortes = []
  for (const p of parrafos) {
    if (!existsSync(p.letras)) continue
    const m = JSON.parse(readFileSync(p.letras, 'utf8'))
    const cadena = m.letras.join('')
    let busca = 0
    for (const trozo of trocear(p.texto)) {
      /* ⚠ SE BUSCA EN LA CADENA QUE DEVOLVIÓ ELEVENLABS, no en el texto
         original: no siempre son iguales —normaliza algún signo— y buscar en el
         original daba −1 y mandaba el subtítulo al segundo cero. */
      const i = cadena.indexOf(trozo, busca)
      if (i < 0) continue
      const j = i + trozo.length - 1
      busca = j + 1
      cortes.push({
        desde: p.desde + (m.desde[i] ?? 0),
        hasta: p.desde + (m.hasta[j] ?? m.desde[i] ?? 0) + 0.12,
        texto: partirEnLineas(trozo),
      })
    }
  }
  cortes.sort((a, b) => a.desde - b.desde)

  /* ⚠ Y NINGUNO PISA AL SIGUIENTE.
     El +0,12 de cola hacía que un corte acabara 73 ms después de que empezara
     el de al lado, y durante esas siete centésimas se pintan LAS DOS placas —
     que es el mismo doble tono que se venía a quitar, más corto y por eso más
     difícil de ver. Se recorta la cola contra el siguiente. */
  for (let i = 0; i < cortes.length - 1; i++) {
    cortes[i].hasta = Math.min(cortes[i].hasta, cortes[i + 1].desde - 0.04)
  }
  return cortes.filter((c) => c.hasta > c.desde + 0.15)
}

const srtDe = (cortes) => cortes.map((c, i) =>
  `${i + 1}\n${srtT(c.desde)} --> ${srtT(c.hasta)}\n${c.texto}\n`).join('\n')

const assDe = (cortes) => [
  '[Script Info]', 'ScriptType: v4.00+', 'PlayResX: 1080', 'PlayResY: 1920',
  // `WrapStyle: 2` = no partir nunca. Ver la nota de ESTILO.
  'WrapStyle: 2', 'ScaledBorderAndShadow: yes', '',
  '[V4+ Styles]',
  'Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,' +
  'Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,' +
  'Alignment,MarginL,MarginR,MarginV,Encoding',
  // `BorderStyle: 3` es la placa. Con 1 sería solo contorno, que es lo que no
  // se leía sobre las tarjetas claras.
  `Style: cf,${ESTILO.fuente},${ESTILO.tamano},${ESTILO.color},${ESTILO.color},` +
  `${ESTILO.contorno},${ESTILO.contorno},0,0,0,0,100,100,0.4,0,3,${ESTILO.grosorContorno},${ESTILO.sombra},` +
  `2,${ESTILO.margenLados},${ESTILO.margenLados},${ESTILO.margenAbajo},1`,
  '', '[Events]', 'Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text',
  ...cortes.map((c) => `Dialogue: 0,${assT(c.desde)},${assT(c.hasta)},cf,,0,0,0,,${c.texto.replace(/\n/g, '\\N')}`),
].join('\n')

// ══ EL GUION ════════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const video = args[0]
if (!video) throw new Error('falta el vídeo: node subtitulos.mjs 14-clientes')
const quemar = args.includes('--quemar')
const iToma = args.indexOf('--toma')

const dir = `${VIDEOS}/tomas-${video.slice(0, 2)}`
const conVoz = readdirSync(dir).filter((f) => f.endsWith('.voz.mp4')).sort()
if (!conVoz.length) throw new Error(`no hay tomas con voz en ${dir}. Corre antes voz.mjs`)
const cuales = iToma >= 0 ? [conVoz[Number(args[iToma + 1]) - 1]] : conVoz

const quemados = []
for (const f of cuales) {
  const base = `${dir}/${basename(f, '.voz.mp4')}`
  const vozJson = `${base}.voz.json`
  if (!existsSync(vozJson)) { console.warn(`  · ${basename(f)}: sin marcas, se salta`); continue }

  const cortes = cortesDe(vozJson)
  writeFileSync(`${base}.srt`, srtDe(cortes))
  writeFileSync(`${base}.ass`, assDe(cortes))
  console.log(`  ✓ ${basename(base)} · ${cortes.length} cortes`)

  if (quemar) {
    /* ⚠ EL FICHERO LIMPIO NO SE TOCA. Quemar es irreversible y el dueño quiere
       poder cambiar de idea: el quemado sale aparte. */
    ff(['-i', `${base}.voz.mp4`, '-vf', `subtitles='${base}.ass'`,
      '-c:a', 'copy', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20',
      '-pix_fmt', 'yuv420p', `${base}.sub.mp4`])
    quemados.push(`${base}.sub.mp4`)
    console.log(`    y quemados en ${basename(base)}.sub.mp4`)
  }
}

/* El vídeo entero, ya con voz y con subtítulos, para no tener que pegar nada.
   El limpio con voz lo deja `voz.mjs` en `<video>.conVoz.mp4`. */
if (quemar && iToma < 0 && quemados.length) {
  const lista = '/tmp/cf-subs-lista.txt'
  writeFileSync(lista, quemados.map((x) => `file '${x}'`).join('\n'))
  const salida = `${VIDEOS}/${video}.conVozYSubs.mp4`
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', salida])
  console.log(`\n✓ ${salida}`)
}
