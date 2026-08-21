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
import { mkdirSync, readdirSync } from 'fs'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'

export const BASE = 'http://localhost:3016'
export const SECRETO = 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'

/**
 * @param nombre      para los mensajes
 * @param dir         carpeta de las tomas   @param final  el .mp4 pegado
 * @param tomas       [{ id, titulo, grabar(util) }]
 * @param cookie      valor de `next-auth.session-token`, o null para pantallas públicas
 * @param antesDeToma opcional: se llama antes de grabar cada toma (limpiar datos, etc.)
 */
export async function correr({ nombre, dir, final, tomas, cookie = null, antesDeToma = null }) {
  const args = process.argv.slice(2)
  const soloPegar = args.includes('--pegar')
  const iToma = args.indexOf('--toma')

  if (!soloPegar) {
    const unaSola = iToma >= 0
    if (!unaSola) vaciar(dir)
    const indices = unaSola ? [Number(args[iToma + 1]) - 1] : tomas.map((_, i) => i)
    if (indices.some((i) => !tomas[i])) throw new Error(`toma fuera de rango (hay ${tomas.length})`)
    await grabarTomas({ dir, tomas, indices, cookie, antesDeToma })
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

async function grabarTomas({ dir, tomas, indices, cookie, antesDeToma }) {
  const nav = await chromium.launch()

  for (const i of indices) {
    const toma = tomas[i]
    const dirGrab = `/tmp/grab-video/${toma.id}`
    vaciar(dirGrab)
    if (antesDeToma) await antesDeToma(toma, i)

    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
    })
    if (cookie) {
      await ctx.addCookies([{ name: 'next-auth.session-token', value: cookie, domain: 'localhost', path: '/' }])
    }
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0
    const zooms = []
    const rotulos = []
    const ahora = () => (Date.now() - t0) / 1000 - desde

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

      /** Subraya y se acerca, también en el instante real. */
      mirar: async (sel, { escala = 1.7, ms = 4200 } = {}) => {
        const t = Math.max(0, ahora())
        const caja = await subrayar(p, sel, { ms })
        zooms.push({ t, dura: Math.max(2.4, ms / 1000 - 0.4), escala, ...caja })
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

      tocar: async (texto, { espera = 1900 } = {}) => {
        // Por texto O por `aria-label`: los iconos de la pastilla no llevan texto.
        await p.locator(
          `button:has-text("${texto}"), a:has-text("${texto}"), [role="button"]:has-text("${texto}"), ` +
          `[aria-label="${texto}"]`,
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
    montarToma({
      entrada: ultimoWebm(dirGrab),
      salida: `${dir}/${String(i).padStart(2, '0')}-${toma.id}.mp4`,
      zooms,
      rotulos: rotulos.map((r, n) => ({ ...r, ...pngs[n] })),
      desde,
    })
    console.log(`   ${rotulos.length} rótulos · ${zooms.length} acercamientos`)
  }

  await nav.close()
}
