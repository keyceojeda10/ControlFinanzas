// scripts/video-demo/grabador.mjs
//
// La maquinaria común de todos los vídeos. Cada guion se queda solo con SUS
// tomas; todo lo demás vive aquí.
//
// ── POR QUÉ SE EXTRAJO ─────────────────────────────────────────────────────
//
// Los cuatro primeros vídeos tenían copiada la misma función `grabar()`, las
// mismas utilidades y la misma escaleta. Cuando el dueño pidió que los procesos
// terminaran —«todos los tutoriales están cortados abruptamente al final»— hubo
// que tocar los cuatro a mano, y así es como dos vídeos acaban comportándose
// distinto sin que nadie lo note.
//
// ── LAS REGLAS, EN UN SOLO SITIO ───────────────────────────────────────────
//
//  1. No se entra por URL a una pantalla que el vídeo explica: se llega tocando.
//  2. Una sección de pantalla, una parada.
//  3. Las pausas se calculan contra lo que hay que decir (~2,4 palabras/s).
//  4. Un acercamiento por parada; el montaje avisa si quedan pegados.
//  5. TODA TOMA TERMINA SU ACCIÓN y descansa sobre el resultado (`reposo`).
//  6. Todo vídeo lleva una toma de CIERRE que completa el proceso y enseña
//     dónde te deja.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync, writeFileSync, readFileSync, existsSync } from 'fs'
import { execFileSync } from 'child_process'

const VIDEOS = '/home/keyce/Desktop/videos-tutoriales'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'

// Con `SIN_ROTULOS=1` la imagen sale limpia y las marcas se guardan igual.
const SIN_ROTULOS = process.env.SIN_ROTULOS === '1'

/* ⚠ POR DÓNDE SE GRABA, Y POR QUÉ SE PUEDE CAMBIAR.
 *
 * Por defecto el espejo local (`arrancar-espejo.sh`), que habla con la base del
 * VPS por un túnel. Eso vale para mirar pantallas, pero NO para escribir: al
 * registrar un pago, la transacción hace decenas de idas y venidas y cada una
 * cruza el túnel. Medido: 5.530 ms para un timeout de 5.000 → «A commit cannot
 * be executed on an expired transaction», y el decorado de la caja se quedaba
 * sin los cuatro cobros del día. El error salía como un 500 genérico.
 *
 * Con `BASE_VIDEO=http://localhost:3105` se graba contra el espejo que corre EN
 * el VPS (`cf-test`, puerto 3005), donde la base es local: solo cruza el túnel
 * lo que ve el navegador.
 *
 *     ssh -f -N -L 3105:127.0.0.1:3005 root@69.62.87.141
 *     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=11-caja node .../v11-caja.mjs
 */
export const BASE = process.env.BASE_VIDEO || 'http://localhost:3016'
export const SECRETO = 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'

/**
 * @param nombre      para los mensajes
 * @param dir         carpeta de las tomas   @param final  el .mp4 pegado
 * @param tomas       [{ id, titulo, grabar(util) }]
 * @param cookie      valor de `next-auth.session-token`, o null para pantallas públicas
 * @param antesDeToma opcional: se llama antes de grabar cada toma (limpiar datos, etc.)
 */
export async function correr({ nombre, dir, final, tomas, cookie = null, antesDeToma = null, locucion = process.env.LOCUCION || null }) {
  const args = process.argv.slice(2)
  const soloPegar = args.includes('--pegar')
  const iToma = args.indexOf('--toma')

  if (!soloPegar) {
    const unaSola = iToma >= 0
    if (!unaSola) vaciar(dir)
    const indices = unaSola ? [Number(args[iToma + 1]) - 1] : tomas.map((_, i) => i)
    if (indices.some((i) => !tomas[i])) throw new Error(`toma fuera de rango (hay ${tomas.length})`)
    await grabarTomas({ dir, tomas, indices, cookie, antesDeToma, locucion })
  }

  const piezas = readdirSync(dir).filter((f) => f.endsWith('.mp4')).sort().map((f) => `${dir}/${f}`)
  if (!piezas.length) throw new Error('no hay tomas que pegar')
  pegar(piezas, final)

  console.log(`\n✓ ${final}`)
  console.log('\n── ESCALETA (para el guion de la voz) ──')
  let reloj = 0
  for (const pieza of piezas) {
    const id = pieza.split('/').pop().replace(/^\d+-|\.mp4$/g, '')
    const toma = tomas.find((t) => t.id === id)
    const m = String(Math.floor(reloj / 60)).padStart(2, '0')
    const sg = String(Math.floor(reloj % 60)).padStart(2, '0')
    const d = duracion(pieza)
    console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(36)} ${d.toFixed(1)}s · caben ~${Math.floor(d * 2.4)} palabras`)
    reloj += d
  }
  const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
  const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
  console.log(`  ${mf}:${sf}  (fin)`)
  return final
}

/**
 * Los párrafos de una toma con su duración real.
 *
 * Sin audio generado devuelve las duraciones a `null` y `narrar` cae a lo
 * declarado: se puede grabar sin haber pagado la voz todavía, aunque el ritmo
 * será el viejo.
 */
function cargarLocucion(locucion, n) {
  if (!locucion) return []
  const f = `${VIDEOS}/locucion/por-toma/${locucion}/toma-${String(n).padStart(2, '0')}.txt`
  if (!existsSync(f)) return []
  const textos = readFileSync(f, 'utf8').trim().split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean)
  const dirAudio = `/tmp/cf-voz/${locucion}/${String(n).padStart(2, '0')}`
  return textos.map((texto, i) => {
    const mp3 = `${dirAudio}/p${i}.mp3`
    let dura = 4.2
    if (existsSync(mp3)) {
      dura = Number(execFileSync('ffprobe',
        ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', mp3]).toString().trim())
    } else if (i === 0) {
      console.warn(`   ⚠ sin audio para la toma ${n}: el ritmo será el estimado. ` +
        `Corre antes: node scripts/video-demo/voz.mjs ${locucion} --solo-audio`)
    }
    return { texto, dura }
  })
}

async function grabarTomas({ dir, tomas, indices, cookie, antesDeToma, locucion }) {
  const nav = await chromium.launch()

  for (const i of indices) {
    const toma = tomas[i]
    const dirGrab = `/tmp/grab-video/${toma.id}`
    vaciar(dirGrab)
    if (antesDeToma) await antesDeToma(toma, i)

    /* ⚠ `toma.userAgent` CAMBIA EL NAVEGADOR QUE CREE SER.
       Hace falta para el vídeo 21: la aplicación enseña los pasos de instalación
       según el navegador, y por defecto salen los de ESCRITORIO —«busca el icono
       en la barra de direcciones… Windows o Mac»—, que en un vídeo vertical para
       el teléfono sería mentir. Con el `userAgent` de un iPhone o de un Android,
       la propia aplicación pinta las instrucciones de verdad: no hay nada
       inventado en pantalla. */
    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
      ...(toma.userAgent ? { userAgent: toma.userAgent } : {}),
    })
    /* Una toma puede entrar con OTRA sesión (`toma.cookie`). Hace falta para
       enseñar lo que ve el cobrador dentro de un vídeo que va del dueño: es la
       mitad de la explicación —para qué sirve crearle una cuenta— y con una
       sola sesión por vídeo había que grabarlo aparte y pegarlo a mano. */
    const galleta = toma.cookie ?? cookie
    if (galleta) {
      await ctx.addCookies([{ name: 'next-auth.session-token', value: galleta, domain: 'localhost', path: '/' }])
    }
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0
    const zooms = []
    const rotulos = []
    const ahora = () => (Date.now() - t0) / 1000 - desde

    /* ── LA LOCUCIÓN DE ESTA TOMA, SI LA HAY ──
       Los párrafos salen de `locucion/por-toma/<video>/toma-NN.txt` y su
       duración del mp3 que `voz.mjs --solo-audio` dejó en la caché. */
    const parrafos = cargarLocucion(locucion, i + 1)

    const util = {
      p,
      /** Marca dónde acaba el camino de acceso y empieza la toma buena. */
      empezar: () => { desde = (Date.now() - t0) / 1000 },
      esperar: (ms) => p.waitForTimeout(ms),

      /* ⚠ NINGUNA TOMA CORTA EN SECO. Termina con la pantalla QUIETA sobre el
         resultado de lo que acaba de hacer. */
      reposo: (ms = 2800) => p.waitForTimeout(ms),

      /** Un rótulo, anclado al instante REAL en que se dice. */
      decir: async (texto, dura = 4.2) => { rotulos.push({ t: Math.max(0, ahora()), dura, texto }) },

      /* ══ NARRAR: LA FRASE MANDA SOBRE EL RELOJ ═══════════════════════════
       *
       * El dueño, con la primera muestra con voz delante: «el vídeo tiene un
       * ritmo demasiado lento». Medido en esa toma: 18,1 segundos de imagen y
       * 7,2 de voz. Once de silencio.
       *
       * Las esperas del guion estaban calculadas contra las palabras que CABÍAN
       * a 2,4 por segundo, no contra las que de verdad se dicen. Y la narración
       * se escribió con margen a propósito. Dos decisiones razonables que juntas
       * dejaban la mitad del vídeo muerto.
       *
       * `narrar(i)` coge el párrafo i de la locución, lee CUÁNTO DURA su mp3 ya
       * generado, lo pone de rótulo y espera exactamente eso. No estima nada.
       *
       * Y el acercamiento va DENTRO de la frase, no después: `mirar` se dispara
       * a los 0,6s y dura lo que le quede a la voz. Antes se decía la frase, se
       * esperaba, y LUEGO se hacía el zoom — dos tiempos muertos por parada.
       *
       * ⚠ Necesita el audio hecho:
       *     node scripts/video-demo/voz.mjs <locucion> --solo-audio
       *   Sin él, `narrar` cae a la duración declarada y avisa. */
      narrar: async (i, { mirar: sel, escala = 1.7, fila = false, pausa = 0.35, dura: forzada, hacer } = {}) => {
        const p = parrafos[i]
        if (!p) throw new Error(`la toma pide el párrafo ${i + 1} y la locución tiene ${parrafos.length}`)
        const d = forzada ?? p.dura
        const t0 = Date.now()
        util.decir(p.texto, d)
        const gastado = () => Date.now() - t0
        const alFinal = (d + pausa) * 1000

        await util.esperar(500)
        if (sel) {
          const ms = Math.min(4400, Math.max(2000, (d - 0.9) * 1000))
          await util.mirar(sel, { escala, ms, fila })
        }
        /* `hacer` es la razón de la segunda queja: «que se puedan ver más
           interacciones, no solamente como un clic en un botón y ya está». La
           acción ocurre MIENTRAS se habla, no después de callar. */
        if (hacer) await hacer()

        const queda = alFinal - gastado()
        if (queda > 0) await util.esperar(queda)
      },

      /**
       * Subraya y se acerca, también en el instante real.
       *
       * `fila: true` SUBRAYA EL RÓTULO PERO ENCUADRA EL RENGLÓN ENTERO.
       *
       * ⚠ Hace falta siempre que el nombre esté a la izquierda y la cifra a la
       * derecha, que es como está escrita media aplicación. Acercándose a «Te
       * queda en la mano» —un rótulo estrecho y pegado al margen— el cuadro se
       * centra en él, se topa con el borde izquierdo y las cifras se van fuera
       * por la derecha: salía «Lo que cobraste» sin número y «−$» cortado. Es
       * la queja del dueño de siempre, «se corta, se desencuadra».
       *
       * El halo sigue marcando la palabra exacta; lo que se ensancha es el
       * encuadre, así que se ve el renglón completo, rótulo y cifra.
       */
      mirar: async (sel, { escala = 1.7, ms = 4200, fila = false } = {}) => {
        const t = Math.max(0, ahora())
        const caja = await subrayar(p, sel, { ms })
        const encuadre = fila ? { ...caja, x: 16, w: 508 } : caja
        zooms.push({ t, dura: Math.max(2.4, ms / 1000 - 0.4), escala, ...encuadre })
        await quitarSubrayado(p)
        return caja
      },

      ir: async (ruta, espera) => {
        await p.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
        if (espera) {
          await p.waitForFunction(
            (re) => new RegExp(re, 'i').test(document.body.innerText),
            espera.source, { timeout: 30000 },
          ).catch(() => {})
        }
        await p.waitForTimeout(1400)
        /* ⚠ NO GRABAR UNA PANTALLA VACÍA. Pasó con el panel: sin la marca de
           onboarding terminado se quedaba con tres nodos, sin que nada fallara,
           y el vídeo salía rotulando un gris. */
        const texto = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
        if (texto.length < 60) {
          throw new Error(
            `La pantalla ${ruta} se quedó vacía (${texto.length} caracteres).\n` +
            'Reinicia el espejo: bash .auditoria/arrancar-espejo.sh',
          )
        }
        await preparar(p)
      },

      escribir: async (sel, texto) => {
        const c = p.locator(sel).first()
        await c.click()
        // Letra a letra: tiene que VERSE que alguien escribe.
        await c.type(texto, { delay: 62 })
        await p.waitForTimeout(700)
      },

      /* Pulsar por SELECTOR, cuando el texto no basta.
         ⚠ `:has-text()` es subcadena y sin acentos de caja: en la ficha de una
         ruta, «Ordenar» caza también «Reordenar recorrido», que está antes en
         el DOM. La toma pulsaba el botón equivocado y grababa otra pantalla sin
         que nada fallara. Para esos casos: `button:text-is("Ordenar")`. */
      tocarSel: async (selector, { espera = 1900 } = {}) => {
        await p.locator(selector).first().click({ timeout: 10000 })
        await p.waitForTimeout(espera)
        await preparar(p).catch(() => {})
      },

      tocar: async (texto, { espera = 1900 } = {}) => {
        /* Por texto O por `aria-label`: los iconos de la pastilla no llevan texto.

           ⚠ `:visible` EN LOS CUATRO. Media app pinta DOS ÁRBOLES —el de móvil
           y el de escritorio, con `hidden lg:block`— y los dos llevan los mismos
           botones con las mismas etiquetas. A 540px la copia de escritorio sigue
           en el DOM y va PRIMERA, así que `.first()` cogía la invisible: la toma
           se quedaba diez segundos esperando a que se dejara pulsar y abortaba.
           Costó tres intentos en el vídeo de rutas antes de mirar el DOM. */
        await p.locator(
          `button:has-text("${texto}"):visible, a:has-text("${texto}"):visible, ` +
          `[role="button"]:has-text("${texto}"):visible, [aria-label="${texto}"]:visible`,
        ).first().click({ timeout: 10000 })
        await p.waitForTimeout(espera)
        await preparar(p).catch(() => {})
      },
    }

    console.log(`· toma ${i + 1}/${tomas.length} — ${toma.titulo}`)
    await toma.grabar(util)
    await ctx.close()

    const pngs = rotulos.length
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/${toma.id}` })
      : []
    mkdirSync(dir, { recursive: true })
    const base = `${dir}/${String(i).padStart(2, '0')}-${toma.id}`

    /* ══ LAS MARCAS DE LA TOMA, EN UN FICHERO AL LADO ═══════════════════════
     *
     * Cada `decir()` sabe EL SEGUNDO EXACTO en que se dice, y hasta ahora ese
     * dato moría aquí: se quemaba en la imagen y se perdía. Guardándolo, la voz
     * de ElevenLabs se puede colocar en el mismo instante que el rótulo, y
     * entonces lo que se oye pasa justo cuando pasa lo que se ve.
     *
     * Es lo que pidió el dueño al pasar su clave: «que la voz vaya
     * correspondiente con los pasos que se van haciendo». */
    writeFileSync(`${base}.marcas.json`, JSON.stringify({
      toma: toma.id, titulo: toma.titulo,
      rotulos: rotulos.map((r) => ({ t: Number(r.t.toFixed(2)), dura: r.dura, texto: r.texto })),
      zooms: zooms.map((z) => ({ t: Number(z.t.toFixed(2)), dura: z.dura })),
    }, null, 2))

    /* ⚠ `SIN_ROTULOS=1` deja la imagen LIMPIA.
     * Con voz, el rótulo repite lo que se está oyendo, y encima tapa la parte
     * baja de la pantalla. Los subtítulos, si se quieren, se ponen después en
     * el editor: un vídeo limpio se puede subtitular, uno quemado no se puede
     * limpiar. */
    montarToma({
      entrada: ultimoWebm(dirGrab),
      salida: `${base}.mp4`,
      zooms,
      rotulos: SIN_ROTULOS ? [] : rotulos.map((r, n) => ({ ...r, ...pngs[n] })),
      desde,
    })
    console.log(`   ${rotulos.length} rótulos${SIN_ROTULOS ? ' (no quemados)' : ''} · ${zooms.length} acercamientos`)
  }

  await nav.close()
}
