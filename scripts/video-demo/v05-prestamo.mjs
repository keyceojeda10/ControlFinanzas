// scripts/video-demo/v05-prestamo.mjs
//
// VÍDEO 5 · Crear un préstamo, y elegir bien el modo de interés
//
//     node scripts/video-demo/v05-prestamo.mjs
//     node scripts/video-demo/v05-prestamo.mjs --toma 8
//     node scripts/video-demo/v05-prestamo.mjs --pegar
//
// El más importante después del onboarding, y el más denso: el modo de interés
// cambia cuánto gana el negocio con el MISMO porcentaje. El sistema tiene un
// ayudante de dos preguntas escrito en el idioma del prestamista —«le cobro una
// cuota igual cada vez», «le cobro solo el interés y el capital al final»— y eso
// es justo lo que hay que enseñar: no hace falta entender la fórmula.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'fs'
import { encode } from 'next-auth/jwt'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'
import { conectar, IDS } from './montar-demo.mjs'

const BASE = 'http://localhost:3016'
const DIR = '/tmp/videos/05-prestamo'
const FINAL = '/tmp/videos/05-prestamo.mp4'
const CLIENTE = 'Fabián Quintero'
const MONTO = '400000'

/** Deja al cliente sin el préstamo de la demostración, para poder repetir. */
const limpiarPrestamos = async () => {
  const cx = await conectar()
  const [[c]] = await cx.query(
    'SELECT id FROM Cliente WHERE organizationId = ? AND nombre = ?', [IDS.org, CLIENTE])
  if (c) {
    // Solo los creados hoy por la grabación: los del negocio de mentira se quedan.
    await cx.execute(
      `DELETE FROM Prestamo WHERE clienteId = ? AND montoPrestado = ? AND DATE(createdAt) = CURDATE()`,
      [c.id, Number(MONTO)]).catch(() => {})
  }
  await cx.end()
}

/** Camino común hasta la pantalla de condiciones. */
const hastaCondiciones = async ({ ir, tocar, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocar('Crear'); await esperar(1200)
  await tocar('Prestarle a alguien'); await esperar(1600)
  await tocar(CLIENTE); await esperar(900)
  await tocar('Continuar')
}

const TOMAS = [
  {
    id: 'entrada',
    titulo: 'Dónde se crea un préstamo',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar }) {
      await ir('/dashboard', /Buenos|Recaudado/i)
      empezar()
      await decir('Un préstamo se hace desde el mismo botón «Crear»', 4.4)
      await tocar('Crear')
      await esperar(3400)
      await mirar('text=Prestarle a alguien', { escala: 1.8, ms: 4200 })
      await decir('Aquí, en «sale plata»: «Prestarle a alguien»', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'cliente',
    titulo: 'A quién le prestas',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar }) {
      await ir('/dashboard', /Buenos|Recaudado/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Prestarle a alguien')
      empezar()
      await esperar(1600)
      await decir('Lo primero: a quién', 3.6)
      await esperar(3800)
      await mirar('text=RECIENTES', { escala: 1.7, ms: 4000 })
      await decir('Los últimos salen de primeras; los demás, buscando por nombre o cédula', 4.8)
      await esperar(5000)
      await tocar(CLIENTE)
      await esperar(1800)
    },
  },
  {
    id: 'monto',
    titulo: 'Cuánto le prestas',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      empezar()
      await decir('Cuánto le entregas en la mano', 4.0)
      await esperar(4200)
      await mirar('button:has-text("500k")', { escala: 1.9, ms: 4000 })
      await decir('Los montos de siempre están ahí, en un toque', 4.2)
      await esperar(4400)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await esperar(2200)
    },
  },
  {
    id: 'frecuencia',
    titulo: 'Cada cuánto te paga',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Cada cuánto te paga: diario, semanal, quincenal o mensual', 4.8)
      await esperar(5000)
      await mirar('button:has-text("Diario")', { escala: 1.8, ms: 4000 })
      await decir('En diario cobra todos los días hábiles', 4.2)
      await esperar(4400)
    },
  },
  {
    id: 'interes',
    titulo: 'La tasa de interés',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Ahora el interés', 3.4)
      await esperar(3600)
      await mirar('button:has-text("20%")', { escala: 1.9, ms: 4200 })
      await decir('Los porcentajes que más se usan están de atajo', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'cuotas',
    titulo: 'Cuántas cuotas, y el «No sé»',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Y en cuántas cuotas te lo paga', 4.0)
      await esperar(4200)
      await mirar('button:has-text("No sé")', { escala: 1.9, ms: 4600 })
      await decir('Si no sabes cuándo te paga, toca «No sé»', 4.2)
      await esperar(4400)
      await decir('El préstamo queda sin vencimiento y solo cobra el interés de cada mes', 4.8)
      await esperar(5000)
    },
  },
  {
    id: 'cuenta',
    titulo: 'La cuenta se hace sola',
    async grabar(u) {
      const { p, esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1600)
      await mirar('text=Total a pagar', { escala: 1.7, ms: 4600 }).catch(async () => {
        await mirar('text=CUOTA', { escala: 1.7, ms: 4600 })
      })
      await decir('Fíjate abajo: la cuota y el total salen solos', 4.6)
      await esperar(4800)
      await decir('No tienes que sacar cuentas ni con calculadora', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'modo-que-es',
    titulo: 'El modo de interés: por qué importa',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1400)
      await mirar('text=¿Cómo cobra el interés?', { escala: 1.7, ms: 4400 })
      await decir('Y ahora lo más importante de esta pantalla', 4.2)
      await esperar(4400)
      await decir('Cómo cobras el interés: el mismo veinte por ciento puede ser tres cosas distintas', 5.2)
      await esperar(5400)
    },
  },
  {
    id: 'ayudante',
    titulo: 'El ayudante de dos preguntas',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1200)
      await mirar('text=Responde 2 preguntas', { escala: 1.7, ms: 4400 })
      await decir('Si no sabes cuál te toca, no adivines', 4.2)
      await esperar(4400)
      await tocar('Responde 2 preguntas')
      await esperar(2600)
      await decir('Te pregunta cómo le cobras a un cliente normal', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'en-tus-palabras',
    titulo: 'Las opciones, en tus palabras',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await tocar('Responde 2 preguntas')
      empezar()
      await esperar(1600)
      await mirar('text=Le cobro una cuota igual cada vez', { escala: 1.6, ms: 4600 })
      await decir('«Le cobro una cuota igual cada vez»: el más común', 4.6)
      await esperar(4800)
      await mirar('text=Le cobro solo el interés', { escala: 1.6, ms: 4600 })
      await decir('«Solo el interés, y el capital al final, de una»', 4.6)
      await esperar(4800)
      await mirar('text=Le cobro un interés fijo, una sola vez', { escala: 1.6, ms: 4800 })
      await decir('«Presto cien mil y me devuelve ciento veinte, se demore lo que se demore»', 5.2)
      await esperar(5400)
    },
  },
  {
    id: 'recomendado',
    titulo: 'El que usa casi todo el mundo',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1400)
      await mirar('text=RECOMENDADO', { escala: 1.7, ms: 4400 })
      await decir('Si no estás seguro, déjalo en «cuota fija»', 4.4)
      await esperar(4600)
      await decir('Es el que usa casi todo el mundo y el que viene puesto', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'revisar',
    titulo: 'Revisar y crear',
    async grabar(u) {
      const { p, esperar, escribir, empezar, decir, mirar, tocar } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1200)
      await mirar('button:has-text("Revisar préstamo")', { escala: 1.7, ms: 4000 })
      await decir('Antes de crearlo, lo revisas', 4.0)
      await esperar(4200)
      await tocar('Revisar préstamo')
      await esperar(3400)
      await decir('Aquí ves cómo queda antes de entregar la plata', 4.6)
      await esperar(4800)
    },
  },
]

async function grabar(indices) {
  const nav = await chromium.launch()
  const token = await encode({
    token: {
      sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo',
      rol: 'owner', organizationId: IDS.org, plan: 'professional', country: 'co',
      orgNombre: 'Créditos del Valle', rutaIds: [],
    },
    secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
  })

  for (const i of indices) {
    const toma = TOMAS[i]
    const dirGrab = `/tmp/grab-05/${toma.id}`
    vaciar(dirGrab)
    await limpiarPrestamos()

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
      decir: async (texto, dura = 4.2) => { rotulos.push({ t: Math.max(0, ahora()), dura, texto }) },
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
        if (texto.length < 60) throw new Error(`La pantalla ${ruta} se quedó vacía.`)
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
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/05-${toma.id}` })
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

if (!soloPegar) {
  const unaSola = iToma >= 0
  if (!unaSola) vaciar(DIR)
  const indices = unaSola ? [Number(args[iToma + 1]) - 1] : TOMAS.map((_, i) => i)
  if (indices.some((i) => !TOMAS[i])) throw new Error(`toma fuera de rango (hay ${TOMAS.length})`)
  await grabar(indices)
  await limpiarPrestamos()
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
