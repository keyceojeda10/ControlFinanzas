// scripts/video-demo/voz.mjs
//
// LA VOZ, PEGADA AL PASO QUE SE ESTÁ VIENDO
//
//     node scripts/video-demo/voz.mjs 14-clientes            # el vídeo entero
//     node scripts/video-demo/voz.mjs 14-clientes --toma 1   # una sola toma
//     node scripts/video-demo/voz.mjs 14-clientes --cuanto   # solo dice el coste
//
// ── QUÉ HACE, Y POR QUÉ ASÍ ────────────────────────────────────────────────
//
// El dueño: «la idea es que la voz vaya correspondiente con los pasos que se
// van haciendo». Eso no se consigue generando el audio del vídeo entero y
// soltándolo encima: se desfasa a los treinta segundos y no hay forma de
// recuperarlo.
//
// Se consigue porque cada `decir()` de la grabación GUARDA SU SEGUNDO. Ahora el
// grabador escribe esas marcas en un `.marcas.json` al lado de cada toma, y
// aquí se genera **un audio por párrafo** y se coloca cada uno en el segundo de
// su rótulo. Lo que se oye pasa cuando pasa lo que se ve, párrafo a párrafo, y
// no hay deriva posible: cada trozo tiene su propia ancla.
//
// ── LO QUE SE HACE CUANDO NO CUADRA ────────────────────────────────────────
//
//  · Si la voz de un párrafo es MÁS LARGA que el hueco hasta el siguiente, se
//    respeta igual el ancla del siguiente: se solaparían, así que el siguiente
//    se corre lo justo. Se avisa por consola, porque lo que hay que arreglar es
//    la toma —alargarla—, no el audio.
//  · Si la voz entera es más larga que la toma, se CONGELA el último fotograma
//    lo que haga falta. Es invisible: toda toma termina quieta sobre el
//    resultado (`reposo`), así que congelar más no se nota.
//  · Si sobra vídeo, se deja. «Si sobra tiempo, callar.»
//
// ── ⚠ LA CLAVE NO VIVE EN EL REPOSITORIO ───────────────────────────────────
//
//     ~/.config/cf/elevenlabs.env      (chmod 600, fuera de git)
//
// ── ⚠ Y LOS CARACTERES SE PAGAN ────────────────────────────────────────────
//
// El plan de ElevenLabs cuenta CARACTERES, no minutos. Los diecisiete vídeos
// suman ~41.000 y el plan «starter» da 31.900 al mes. Por eso existe
// `--cuanto`: dice lo que va a costar ANTES de gastar, y el guion se planta si
// no queda saldo.

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs'
import { execFileSync } from 'child_process'
import { homedir } from 'os'
import { dirname, basename } from 'path'

const VIDEOS = '/home/keyce/Desktop/videos-tutoriales'
const VOZ = 'dXtC3XhB9GtPusIpNtQx'   // Hale · Great for Commercials
const MODELO = 'eleven_multilingual_v2'

/* Los ajustes que el dueño dejó fijados en la pantalla de ElevenLabs. Van aquí
   y no en la línea de comandos: si cada generación usa unos distintos, dos
   tomas del mismo vídeo suenan a dos personas. */
const AJUSTES = {
  speed: 1.05,
  stability: 0.78,
  similarity_boost: 0.75,
  style: 0.70,
  use_speaker_boost: true,
}

const ff = (args) => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args])
const dur = (f) => Number(execFileSync('ffprobe',
  ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', f]).toString().trim())

function clave() {
  const ruta = `${homedir()}/.config/cf/elevenlabs.env`
  if (!existsSync(ruta)) throw new Error(`falta ${ruta} con ELEVENLABS_API_KEY`)
  const m = readFileSync(ruta, 'utf8').match(/ELEVENLABS_API_KEY=(\S+)/)
  if (!m) throw new Error(`${ruta} no tiene ELEVENLABS_API_KEY`)
  return m[1]
}

/** Lo que queda de saldo este ciclo. */
async function saldo(key) {
  const r = await fetch('https://api.elevenlabs.io/v1/user/subscription', { headers: { 'xi-api-key': key } })
  if (!r.ok) throw new Error(`ElevenLabs dice ${r.status} al mirar el saldo`)
  const d = await r.json()
  return { usados: d.character_count, tope: d.character_limit, quedan: d.character_limit - d.character_count }
}

/**
 * Un párrafo → un mp3.
 *
 * ⚠ `previous_text` y `next_text` NO son adorno: sin ellos cada párrafo se
 * genera como si fuera una frase suelta y la entonación se reinicia en cada
 * corte. Con ellos, la voz sabe que viene de algo y que sigue, y los trozos
 * suenan a una sola locución.
 */
async function decirlo(key, texto, { antes = '', despues = '' } = {}) {
  /* ⚠ `with-timestamps` EN VEZ DEL NORMAL, Y CUESTA LO MISMO.
     Devuelve el audio Y a qué segundo suena cada letra. Con eso los subtítulos
     salen clavados —no repartidos a ojo por número de caracteres— y son las
     palabras que de verdad se dicen, no un resumen escrito aparte. Pedir el
     audio sin las marcas era tirar un dato gratis. */
  const r = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOZ}/with-timestamps?output_format=mp3_44100_128`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: texto,
        model_id: MODELO,
        voice_settings: AJUSTES,
        previous_text: antes || undefined,
        next_text: despues || undefined,
      }),
    })
  if (!r.ok) throw new Error(`ElevenLabs dice ${r.status}: ${(await r.text()).slice(0, 300)}`)
  const d = await r.json()
  const a = d.alignment || d.normalized_alignment || {}
  return {
    audio: Buffer.from(d.audio_base64, 'base64'),
    letras: a.characters || [],
    desde: a.character_start_times_seconds || [],
    hasta: a.character_end_times_seconds || [],
  }
}

/** Los párrafos de una toma, tal como los dejó `locucion/regenerar.py`. */
function parrafosDe(video, n) {
  const f = `${VIDEOS}/locucion/por-toma/${video}/toma-${String(n).padStart(2, '0')}.txt`
  if (!existsSync(f)) throw new Error(`no encuentro ${f}`)
  return readFileSync(f, 'utf8').trim().split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
}

/** Las tomas de un vídeo, en orden, con su fichero y sus marcas. */
function tomasDe(video) {
  const dir = `${VIDEOS}/tomas-${video.slice(0, 2)}`
  /* ⚠ SOLO LAS TOMAS DE VERDAD: `NN-id.mp4`.
     Los derivados —`.voz.mp4`, `.sub.mp4`— también acaban en `.mp4` y se
     contaban como tomas nuevas: la lista crecía, los números bailaban y cada
     párrafo se iba a la toma de al lado. Excluirlos uno a uno no vale, porque
     el siguiente derivado que se invente vuelve a romperlo; se acepta solo el
     patrón bueno. */
  return readdirSync(dir).filter((f) => /^\d\d-[\wáéíóúñ]+\.mp4$/i.test(f)).sort()
    .map((f, i) => ({
      n: i + 1,
      mp4: `${dir}/${f}`,
      marcas: `${dir}/${f.replace(/\.mp4$/, '.marcas.json')}`,
    }))
}

/**
 * Monta la voz de UNA toma sobre su vídeo.
 *
 * Devuelve el mp4 con audio, o null si no había nada que decir.
 */
async function ponerVozA(key, video, toma, { soloContar = false, gastado = { chars: 0 } } = {}) {
  const parrafos = parrafosDe(video, toma.n)
  gastado.chars += parrafos.reduce((a, p) => a + p.length, 0)
  if (soloContar) return null

  const marcas = existsSync(toma.marcas)
    ? JSON.parse(readFileSync(toma.marcas, 'utf8')).rotulos || []
    : []

  /* ── DÓNDE EMPIEZA CADA PÁRRAFO ──────────────────────────────────────────
     Con marcas, en el segundo de su rótulo: es lo que alinea voz y pantalla.
     Sin marcas —las tomas grabadas antes de que esto existiera— se reparten
     seguidos desde el principio, que es lo que se podía hacer antes. */
  const anclas = parrafos.map((_, i) => (marcas[i] ? marcas[i].t : null))

  const tmp = `/tmp/cf-voz/${video}/${String(toma.n).padStart(2, '0')}`
  mkdirSync(tmp, { recursive: true })

  const piezas = []
  for (let i = 0; i < parrafos.length; i++) {
    const mp3 = `${tmp}/p${i}.mp3`
    const marcasLetras = `${tmp}/p${i}.letras.json`
    if (!existsSync(mp3) || !existsSync(marcasLetras)) {
      // Se cachea: rehacer una toma no vuelve a pagar los párrafos que no
      // cambiaron, y el plan cuenta caracteres.
      const v = await decirlo(key, parrafos[i], {
        antes: parrafos[i - 1] || '', despues: parrafos[i + 1] || '',
      })
      writeFileSync(mp3, v.audio)
      writeFileSync(marcasLetras, JSON.stringify(
        { texto: parrafos[i], letras: v.letras, desde: v.desde, hasta: v.hasta }))
    }
    piezas.push({ mp3, letras: marcasLetras, dura: dur(mp3), ancla: anclas[i] })
  }

  // ── Las posiciones definitivas, sin solaparse ──
  let reloj = 0
  for (const p of piezas) {
    p.desde = p.ancla == null ? reloj : Math.max(reloj, p.ancla)
    if (p.ancla != null && p.desde > p.ancla + 0.05) {
      console.warn(`   ⚠ toma ${toma.n}: el párrafo se corre ${(p.desde - p.ancla).toFixed(1)}s ` +
        '— el anterior no cabía. Alarga esa parada en el guion.')
    }
    reloj = p.desde + p.dura + 0.25   // un respiro entre párrafos
  }

  const finVoz = reloj
  const largoVideo = dur(toma.mp4)
  const salida = `${dirname(toma.mp4)}/${basename(toma.mp4, '.mp4')}.voz.mp4`

  /* ⚠ SI LA VOZ SE PASA, SE CONGELA EL ÚLTIMO FOTOGRAMA.
     Cortar la voz es perder información; acelerarla, delatarse. Y congelar no
     se nota: cada toma termina quieta sobre el resultado. */
  const sobra = Math.max(0, finVoz + 0.4 - largoVideo)
  const video1 = sobra > 0.05 ? `${tmp}/estirado.mp4` : toma.mp4
  if (sobra > 0.05) {
    ff(['-i', toma.mp4, '-vf', `tpad=stop_mode=clone:stop_duration=${sobra.toFixed(2)}`,
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-pix_fmt', 'yuv420p', video1])
    console.log(`   toma ${toma.n}: la voz pide ${sobra.toFixed(1)}s más; se congela el final`)
  }

  // ── La pista: cada párrafo retrasado a su sitio y todos mezclados ──
  const entradas = piezas.flatMap((p) => ['-i', p.mp3])
  const retrasos = piezas.map((p, i) =>
    `[${i + 1}:a]adelay=${Math.round(p.desde * 1000)}|${Math.round(p.desde * 1000)}[a${i}]`)
  const mezcla = `${piezas.map((_, i) => `[a${i}]`).join('')}amix=inputs=${piezas.length}:normalize=0`

  /* ⚠ NADA DE `-shortest`.
     Lo puse primero y recortaba la toma: la voz acababa antes que la imagen y
     el vídeo perdía su `reposo` final —de 18,1s a 17,1s—. Toda toma termina
     quieta sobre el resultado A PROPÓSITO, y eso es lo primero que se llevaba
     por delante. Se rellena el audio con silencio hasta el final del vídeo. */
  /* El mapa de la toma: dónde acabó cada párrafo y dónde están sus marcas de
     letras. Lo lee `subtitulos.mjs`, que así no tiene que adivinar nada. */
  writeFileSync(`${dirname(toma.mp4)}/${basename(toma.mp4, '.mp4')}.voz.json`, JSON.stringify({
    parrafos: piezas.map((p, i) => ({ desde: Number(p.desde.toFixed(3)), dura: p.dura, letras: p.letras, texto: parrafos[i] })),
  }, null, 2))

  const largoFinal = dur(video1)
  ff([
    '-i', video1, ...entradas,
    '-filter_complex', [...retrasos, `${mezcla},apad[vozp]`].join(';'),
    '-map', '0:v', '-map', '[vozp]',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-t', largoFinal.toFixed(2),
    salida,
  ])
  return salida
}

// ══ EL GUION ════════════════════════════════════════════════════════════════

const args = process.argv.slice(2)
const video = args[0]
if (!video) throw new Error('falta el vídeo: node voz.mjs 14-clientes')
const iToma = args.indexOf('--toma')
const soloContar = args.includes('--cuanto')
const soloAudio = args.includes('--solo-audio')

/* ══ EL AUDIO SE HACE ANTES QUE EL VÍDEO ═══════════════════════════════════
 *
 * El dueño, viendo la primera muestra: «el vídeo tiene un ritmo demasiado
 * lento». Y tenía razón, con números: la toma duraba 18,1s y la voz solo
 * hablaba 7,2. Once segundos de silencio.
 *
 * La causa es que las esperas del guion se calcularon contra las palabras que
 * CABÍAN a 2,4 por segundo, y la narración se escribió con margen a propósito
 * («si sobra tiempo, callar»). Las dos decisiones eran razonables y juntas
 * dejaban el vídeo muerto.
 *
 * Con `--solo-audio` los mp3 se generan primero y quedan en la caché. Entonces
 * la grabación puede preguntar cuánto dura CADA FRASE y esperar exactamente
 * eso. No hay que estimar nada.
 *
 *     node scripts/video-demo/voz.mjs 14-clientes --solo-audio
 *     SIN_ROTULOS=1 LOCUCION=14-clientes node scripts/video-demo/v14-clientes.mjs
 *     node scripts/video-demo/voz.mjs 14-clientes
 */
if (soloAudio) {
  const key0 = clave()
  const s0 = await saldo(key0)
  const todas0 = tomasDe(video)
  let chars = 0
  for (const t of todas0) {
    const parrafos = parrafosDe(video, t.n)
    chars += parrafos.reduce((a, x) => a + x.length, 0)
  }
  if (chars > s0.quedan) {
    console.error(`⚠ ${video} pide ${chars} caracteres y solo quedan ${s0.quedan}. No se genera nada.`)
    process.exit(1)
  }
  console.log(`audio de ${video} · ${todas0.length} tomas · ${chars} caracteres`)
  for (const t of todas0) {
    const parrafos = parrafosDe(video, t.n)
    const tmp = `/tmp/cf-voz/${video}/${String(t.n).padStart(2, '0')}`
    mkdirSync(tmp, { recursive: true })
    for (let i = 0; i < parrafos.length; i++) {
      const mp3 = `${tmp}/p${i}.mp3`
      const letras = `${tmp}/p${i}.letras.json`
      if (existsSync(mp3) && existsSync(letras)) continue
      const v = await decirlo(key0, parrafos[i], {
        antes: parrafos[i - 1] || '', despues: parrafos[i + 1] || '',
      })
      writeFileSync(mp3, v.audio)
      writeFileSync(letras, JSON.stringify({ texto: parrafos[i], letras: v.letras, desde: v.desde, hasta: v.hasta }))
    }
    process.stdout.write(`  toma ${t.n} ✓  `)
  }
  console.log(`
✓ audio en /tmp/cf-voz/${video}`)
  process.exit(0)
}

const key = clave()
const s = await saldo(key)
const todas = tomasDe(video)
const tomas = iToma >= 0 ? [todas[Number(args[iToma + 1]) - 1]] : todas
if (tomas.some((t) => !t)) throw new Error(`toma fuera de rango (hay ${todas.length})`)

const gastado = { chars: 0 }
if (soloContar) {
  for (const t of tomas) await ponerVozA(key, video, t, { soloContar: true, gastado })
  console.log(`${video}: ${gastado.chars} caracteres · te quedan ${s.quedan} de ${s.tope}`)
  console.log(gastado.chars > s.quedan
    ? `⚠ NO ALCANZA: faltan ${gastado.chars - s.quedan}`
    : `✓ alcanza, quedarían ${s.quedan - gastado.chars}`)
  process.exit(0)
}

console.log(`voz de ${video} · ${tomas.length} toma(s) · saldo ${s.quedan} de ${s.tope}`)
const hechas = []
for (const t of tomas) {
  const f = await ponerVozA(key, video, t, { gastado })
  hechas.push(f)
  console.log(`  ✓ ${basename(f)}`)
}
console.log(`\n${gastado.chars} caracteres gastados · quedan ~${s.quedan - gastado.chars}`)

if (iToma < 0) {
  const salida = `${VIDEOS}/${video}.conVoz.mp4`
  const lista = '/tmp/cf-voz-lista.txt'
  writeFileSync(lista, hechas.map((f) => `file '${f}'`).join('\n'))
  ff(['-f', 'concat', '-safe', '0', '-i', lista, '-c', 'copy', '-movflags', '+faststart', salida])
  console.log(`\n✓ ${salida}`)
}
