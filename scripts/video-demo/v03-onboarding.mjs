// scripts/video-demo/v03-onboarding.mjs
//
// VÍDEOS 3 y 4 · Los primeros pasos, en sus dos caminos
//
//     FLUJO=solo       node scripts/video-demo/v03-onboarding.mjs
//     FLUJO=cobradores node scripts/video-demo/v03-onboarding.mjs
//     FLUJO=solo       node scripts/video-demo/v03-onboarding.mjs --toma 3
//
// El onboarding se bifurca en la primera pregunta —«¿quién cobra?»— y a partir
// de ahí NO es el mismo producto: cambian los planes que se ofrecen y cambian
// las tareas que quedan pendientes. Por eso son dos vídeos y no uno con un
// «si tienes cobradores, entonces…».
//
//   yo cobro          Inicial $39.000 · Básico $59.000 · Crecimiento $79.000
//                     6 tareas (sin ruta ni cobrador)
//   tengo cobradores  Crecimiento $79.000 · Profesional $119.000 · Empresarial $259.000
//                     8 tareas (se añaden crear ruta y agregar cobrador)
//
// Es el vídeo que más falta hace: el 75% de los negocios se queda atascado en
// cinco clientes o menos, y esta guía es justo la que empuja a pasar de ahí.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'fs'
import { encode } from 'next-auth/jwt'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'
import { CUENTA, crearCuentaNueva, borrarCuentaNueva } from './cuenta-nueva.mjs'

const BASE = 'http://localhost:3016'
const FLUJO = process.env.FLUJO === 'cobradores' ? 'cobradores' : 'solo'
const SOLO = FLUJO === 'solo'
const NOMBRE = SOLO ? '03-primeros-pasos-solo' : '04-primeros-pasos-equipo'
const DIR = `/tmp/videos/${NOMBRE}`
const FINAL = `/tmp/videos/${NOMBRE}.mp4`
const CAPITAL = '2000000'

const ELEGIR = SOLO ? 'Yo cobro' : 'Tengo cobradores'

const TOMAS = [
  {
    id: 'llegada',
    titulo: 'La guía de primeros pasos',
    async grabar({ ir, esperar, empezar, decir, mirar }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      empezar()
      await decir('Nada más entrar, el sistema te guía', 4.0)
      await esperar(4400)
      await mirar('text=Tres minutos', { escala: 1.8, ms: 4000 })
      await decir('Son cuatro preguntas y tres minutos', 4.0)
      await esperar(4400)
      await decir('Todo lo que crees aquí lo puedes cambiar después', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'quien-cobra',
    titulo: 'Paso 1 · ¿quién cobra?',
    async grabar({ p, ir, esperar, empezar, decir, mirar, tocar }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      empezar()
      await decir('La primera pregunta es la que más cambia todo', 4.4)
      await esperar(4600)
      await mirar(`button:has-text("${ELEGIR}")`, { escala: 1.7, ms: 4200 })
      await decir(
        SOLO
          ? 'Si tú mismo sales a cobrar, «Yo cobro»'
          : 'Si tienes gente cobrando por ti, «Tengo cobradores»',
        4.4,
      )
      await esperar(4600)
      await tocar(ELEGIR)
      await decir(
        SOLO
          ? 'Diecinueve de cada veinte negocios empiezan así'
          : 'Vas a poder crearles su cuenta y asignarles rutas',
        4.6,
      )
      await esperar(4800)
    },
  },
  {
    id: 'capital',
    titulo: 'Paso 2 · con cuánto arrancas',
    async grabar({ p, ir, esperar, empezar, decir, mirar, tocar, escribir }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      await tocar(ELEGIR); await esperar(900)
      await tocar('Continuar')
      empezar()
      await decir('Ahora, con cuánta plata arrancas', 4.0)
      await esperar(4400)
      await escribir('input[inputmode="decimal"], input[type="text"]', CAPITAL)
      await decir('Es el efectivo que tienes hoy para prestar', 4.2)
      await esperar(4400)
      await mirar('text=tu caja va a quedar en negativo', { escala: 1.7, ms: 4600 })
      await decir('Si lo dejas en cero, tu caja arranca en negativo', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'planes',
    titulo: 'Paso 3 · los catorce días y los planes',
    async grabar({ p, ir, esperar, empezar, decir, mirar, tocar, escribir }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      await tocar(ELEGIR); await esperar(900)
      await tocar('Continuar')
      await escribir('input[inputmode="decimal"], input[type="text"]', CAPITAL)
      await tocar('Continuar')
      empezar()
      await decir('Catorce días con todo abierto, sin tarjeta', 4.4)
      await esperar(4600)
      await mirar('text=GRATIS 14 DÍAS', { escala: 1.8, ms: 4200 })
      await decir('No hay cobro automático: no se te descuenta nada', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'cual-plan',
    titulo: 'Paso 3 · qué plan sirve para qué',
    async grabar({ p, ir, esperar, empezar, decir, mirar, tocar, escribir }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      await tocar(ELEGIR); await esperar(900)
      await tocar('Continuar')
      await escribir('input[inputmode="decimal"], input[type="text"]', CAPITAL)
      await tocar('Continuar')
      empezar()
      await esperar(1400)
      await mirar(
        SOLO ? 'button:has-text("Inicial")' : 'button:has-text("Crecimiento")',
        { escala: 1.6, ms: 4600 },
      )
      await decir(
        SOLO
          ? 'Los planes van por el tamaño de tu cartera, no por el tiempo'
          : 'Los planes van por cuántos cobradores y cuántos clientes llevas',
        4.8,
      )
      await esperar(5000)
      await mirar(
        SOLO ? 'button:has-text("Crecimiento")' : 'button:has-text("Empresarial")',
        { escala: 1.6, ms: 4600 },
      )
      await decir(
        SOLO
          ? 'Y si algún día contratas cobradores, subes a Crecimiento'
          : 'Y va creciendo contigo: hasta nueve cobradores y diez rutas',
        4.8,
      )
      await esperar(5000)
      await decir('No tienes que elegir ahora: te avisan cuando llegues al tope', 4.8)
      await esperar(5000)
    },
  },
  {
    id: 'cartera',
    titulo: 'Paso 4 · traer tu cartera',
    async grabar({ p, ir, esperar, empezar, decir, mirar, tocar, escribir }) {
      await ir('/dashboard', /vamos a cargar tu cartera/i)
      await tocar(ELEGIR); await esperar(900)
      await tocar('Continuar')
      await escribir('input[inputmode="decimal"], input[type="text"]', CAPITAL)
      await tocar('Continuar')
      await tocar('Cargar mi cartera')
      empezar()
      await decir('Y lo último: meter los préstamos que ya tienes', 4.6)
      await esperar(4800)
      await mirar('text=RECOMENDADO', { escala: 1.7, ms: 4200 })
      await decir('Lo normal es escribir a mano los de esta semana', 4.4)
      await esperar(4600)
      await mirar('text=Tómale foto a tu libreta', { escala: 1.7, ms: 4400 })
      await decir('O le tomas foto a la libreta: cuarenta préstamos, veinte minutos', 4.8)
      await esperar(5000)
      await decir('Y si lo tienes en Excel, subes el archivo', 4.2)
      await esperar(4400)
    },
  },
]

async function grabar(indices) {
  const nav = await chromium.launch()
  const token = await encode({
    token: {
      sub: CUENTA.owner, id: CUENTA.owner, email: CUENTA.correo, name: CUENTA.nombre,
      rol: 'owner', organizationId: CUENTA.org, plan: 'professional', country: 'co',
      orgNombre: CUENTA.negocio, rutaIds: [],
    },
    secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
  })

  for (const i of indices) {
    const toma = TOMAS[i]
    const dirGrab = `/tmp/grab-03/${FLUJO}-${toma.id}`
    vaciar(dirGrab)
    // Cuenta nueva en cada toma: el onboarding solo existe una vez.
    await crearCuentaNueva()

    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
    })
    await ctx.addCookies([{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/' }])
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0
    const zooms = []
    const rotulos = []
    const ahora = () => (Date.now() - t0) / 1000 - desde

    const util = {
      p,
      empezar: () => { desde = (Date.now() - t0) / 1000 },
      esperar: (ms) => p.waitForTimeout(ms),
      decir: async (texto, dura = 4.0) => { rotulos.push({ t: Math.max(0, ahora()), dura, texto }) },
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
        const texto = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
        if (texto.length < 60) {
          throw new Error(`La pantalla ${ruta} se quedó vacía (${texto.length} caracteres).`)
        }
        await preparar(p)
      },
      escribir: async (sel, texto) => {
        const c = p.locator(sel).first()
        await c.click()
        await c.type(texto, { delay: 62 })
        await p.waitForTimeout(700)
      },
      tocar: async (texto) => {
        await p.locator(
          `button:has-text("${texto}"), a:has-text("${texto}"), [role="button"]:has-text("${texto}"), ` +
          `[aria-label="${texto}"]`,
        ).first().click({ timeout: 10000 })
        await p.waitForTimeout(1900)
        await preparar(p).catch(() => {})
      },
    }

    console.log(`· toma ${i + 1}/${TOMAS.length} — ${toma.titulo}`)
    await toma.grabar(util)
    await ctx.close()

    const pngs = rotulos.length
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/03-${FLUJO}-${toma.id}` })
      : []
    mkdirSync(DIR, { recursive: true })
    montarToma({
      entrada: ultimoWebm(dirGrab),
      salida: `${DIR}/${String(i).padStart(2, '0')}-${toma.id}.mp4`,
      zooms,
      rotulos: rotulos.map((r, n) => ({ ...r, ...pngs[n] })),
      desde,
    })
    console.log(`   ${rotulos.length} rótulos · ${zooms.length} acercamientos`)
  }

  await nav.close()
}

const args = process.argv.slice(2)
const soloPegar = args.includes('--pegar')
const iToma = args.indexOf('--toma')

console.log(`\n══ ${SOLO ? 'YO COBRO' : 'TENGO COBRADORES'} ══\n`)

if (!soloPegar) {
  const unaSola = iToma >= 0
  if (!unaSola) vaciar(DIR)
  const indices = unaSola ? [Number(args[iToma + 1]) - 1] : TOMAS.map((_, i) => i)
  if (indices.some((i) => !TOMAS[i])) throw new Error(`toma fuera de rango (hay ${TOMAS.length})`)
  await grabar(indices)
  await borrarCuentaNueva()
}

const piezas = readdirSync(DIR).filter((f) => f.endsWith('.mp4')).sort().map((f) => `${DIR}/${f}`)
if (!piezas.length) throw new Error('no hay tomas que pegar')
pegar(piezas, FINAL)

console.log(`\n✓ ${FINAL}`)
console.log('\n── ESCALETA (para el guion de la voz) ──')
let reloj = 0
for (const pieza of piezas) {
  const id = pieza.split('/').pop().replace(/^\d+-|\.mp4$/g, '')
  const toma = TOMAS.find((t) => t.id === id)
  const m = String(Math.floor(reloj / 60)).padStart(2, '0')
  const sg = String(Math.floor(reloj % 60)).padStart(2, '0')
  const d = duracion(pieza)
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(36)} ${d.toFixed(1)}s · caben ~${Math.floor(d * 2.4)} palabras`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
