// scripts/video-demo/v01-registro.mjs
//
// VÍDEO 1 · Cómo registrarse en el sistema
//
// ── SE GRABA POR TOMAS ─────────────────────────────────────────────────────
//
// Una toma por pantalla del asistente. Si una sale mal se rehace SOLO esa:
//
//     node scripts/video-demo/v01-registro.mjs            # todas y pega
//     node scripts/video-demo/v01-registro.mjs --toma 3   # solo la 3
//     node scripts/video-demo/v01-registro.mjs --pegar    # pega las que hay
//
// Las tomas quedan en `/tmp/videos/01-registro/` y el vídeo final sale de
// pegarlas. Lo pidió el dueño al ver el primer montaje, y tiene razón: rehacer
// 55 segundos por un rótulo mal puesto es absurdo.
//
// ⚠ Se registra una cuenta DE VERDAD, en el espejo, con un correo de
//   `ejemplo.com` (reservado por norma para documentación). Se borra antes y
//   después de grabar.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'fs'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'
import { conectar } from './montar-demo.mjs'

const BASE = 'http://localhost:3016'
const DIR = '/tmp/videos/01-registro'
const FINAL = '/tmp/videos/01-registro.mp4'
const CORREO = 'carlos.mejia@ejemplo.com'
const DATOS = {
  nombre: 'Carlos Andrés Mejía',
  negocio: 'Créditos La Cosecha',
  telefono: '3009998877',
  clave: 'MiClaveSegura2026',
}

// ── Las tomas ──────────────────────────────────────────────────────────────
//
// Cada una devuelve sus rótulos y acercamientos con el instante EN QUE OCURREN
// DENTRO DE LA TOMA. Al ser independientes, los tiempos empiezan en cero en
// cada una: por eso una toma se puede repetir sin tocar las demás.
const TOMAS = [
  {
    id: 'entrada',
    titulo: 'La pantalla de registro',
    async grabar({ ir, esperar }) {
      await ir('/registro', /Paso 1 de 4/)
      await esperar(3200)
      return { rotulos: [{ t: 0.4, dura: 2.6, texto: 'Crear tu cuenta son cuatro pasos' }] }
    },
  },
  {
    id: 'nombre',
    titulo: 'Paso 1 · tu nombre',
    async grabar({ p, ir, esperar, escribir, seguir, empezar }) {
      await ir('/registro', /Paso 1 de 4/)
      empezar()
      await esperar(900)
      const caja = await subrayar(p, 'input[type="text"]', { ms: 1700 })
      await quitarSubrayado(p)
      await escribir('input[type="text"]', DATOS.nombre)
      await seguir('Continuar')
      return {
        rotulos: [{ t: 0.5, dura: 2.6, texto: 'Primero, tu nombre' }],
        zooms: [{ t: 0.6, dura: 2.0, escala: 1.9, ...caja }],
      }
    },
  },
  {
    id: 'negocio',
    titulo: 'Paso 2 · el negocio',
    async grabar({ ir, escribir, esperar, seguir, empezar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre)
      await seguir('Continuar')
      empezar()
      await esperar(1100)
      await escribir('input[type="text"]', DATOS.negocio)
      await seguir('Continuar')
      return {
        rotulos: [{
          t: 0.3, dura: 3.4,
          texto: 'El nombre de tu negocio: el que ven tus clientes y tus cobradores',
        }],
      }
    },
  },
  {
    id: 'whatsapp',
    titulo: 'Paso 3 · país y WhatsApp',
    async grabar({ p, ir, esperar, escribir, seguir, empezar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      empezar()
      await esperar(1000)
      const caja = await subrayar(p, 'select', { ms: 2200 })
      await quitarSubrayado(p)
      await escribir('input[type="tel"]', DATOS.telefono)
      await esperar(900)
      await seguir('Continuar')
      return {
        rotulos: [
          { t: 0.4, dura: 2.8, texto: 'Elige tu país: el sistema trabaja en 12 países' },
          { t: 3.8, dura: 2.6, texto: 'Tu WhatsApp: por ahí llega el código' },
        ],
        zooms: [{ t: 0.5, dura: 2.4, escala: 1.7, ...caja }],
      }
    },
  },
  {
    id: 'cuenta',
    titulo: 'Paso 4 · correo, contraseña y términos',
    async grabar({ p, ir, esperar, escribir, seguir, empezar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      empezar()
      await esperar(1000)
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', DATOS.clave)
      await esperar(700)

      /* ⚠ SIN LA CASILLA NO PASA, y hay que enseñarlo: el guion de sondeo se
         quedó dando vueltas aquí porque el botón no hace nada hasta aceptarla. */
      const caja = await subrayar(p, 'input[type="checkbox"]', { ms: 2400, margen: 14 })
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await esperar(800)
      await quitarSubrayado(p)

      const cajaBoton = await subrayar(p, 'button:has-text("Crear cuenta gratis")', { ms: 2200 })
      await quitarSubrayado(p)
      await seguir('Crear cuenta gratis')
      await esperar(3000)

      return {
        rotulos: [
          { t: 0.3, dura: 2.4, texto: 'Tu correo será tu usuario para entrar' },
          { t: 5.4, dura: 2.8, texto: 'Acepta los términos: sin esto el botón no funciona' },
          { t: 8.8, dura: 2.6, texto: 'Catorce días gratis, sin tarjeta' },
        ],
        zooms: [
          { t: 5.5, dura: 2.4, escala: 2.2, ...caja },
          { t: 8.9, dura: 2.2, escala: 1.7, ...cajaBoton },
        ],
      }
    },
  },
  {
    id: 'verificar',
    titulo: 'La verificación',
    async grabar({ p, ir, esperar, escribir, seguir, empezar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', DATOS.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await seguir('Crear cuenta gratis')
      await esperar(3200)
      empezar()
      await esperar(1200)
      let z = null
      try {
        const caja = await subrayar(p, 'button:has-text("Verificar por correo")', { ms: 2400 })
        z = { t: 3.4, dura: 2.2, escala: 1.8, ...caja }
        await quitarSubrayado(p)
      } catch { /* si cambia el rótulo, la toma sigue sin ese acercamiento */ }
      await esperar(2600)
      return {
        rotulos: [
          { t: 0.3, dura: 2.6, texto: 'Te llega un código por WhatsApp' },
          { t: 3.4, dura: 2.6, texto: 'Si no llega, pídelo al correo' },
          { t: 6.4, dura: 2.4, texto: 'O entra ya y verifica después' },
        ],
        zooms: z ? [z] : [],
      }
    },
  },
]

// ── Utilidades ─────────────────────────────────────────────────────────────
const borrarCuenta = async () => {
  const cx = await conectar()
  const [[u]] = await cx.query('SELECT organizationId FROM User WHERE email = ?', [CORREO])
  if (u) {
    for (const t of ['ActividadLog', 'Notificacion', 'SesionActiva', 'Capital', 'Ruta', 'User', 'Organization']) {
      const col = t === 'Organization' ? 'id' : 'organizationId'
      await cx.execute(`DELETE FROM ${t} WHERE ${col} = ?`, [u.organizationId]).catch(() => {})
    }
  }
  await cx.end()
  return Boolean(u)
}

/**
 * Graba las tomas pedidas.
 *
 * ⚠ CADA TOMA ES SU PROPIO CONTEXTO —ahí es donde Playwright decide a qué
 * archivo graba— pero el asistente es un camino: la toma 4 necesita que las
 * anteriores ya se hayan rellenado. Se conserva el estado (`storageState`) y la
 * URL, y la siguiente toma retoma donde quedó la anterior.
 */
async function grabar(indices) {
  const nav = await chromium.launch()

  for (const i of indices) {
    const toma = TOMAS[i]
    const dirGrab = `/tmp/grab-01/${toma.id}`
    vaciar(dirGrab)

    /* Cada toma arranca de cero: contexto nuevo, cuenta borrada y su propio
       camino hasta la pantalla. Así se puede repetir una sola sin que dependa
       de lo que hiciera la anterior. */
    await borrarCuenta()
    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
    })
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0

    const util = {
      p,
      // Marca dónde acaba el camino de acceso y empieza la toma buena.
      empezar: () => { desde = (Date.now() - t0) / 1000 },
      esperar: (ms) => p.waitForTimeout(ms),
      ir: async (ruta, espera) => {
        await p.goto(BASE + ruta, { waitUntil: 'domcontentloaded' })
        if (espera) {
          await p.waitForFunction(
            (re) => new RegExp(re).test(document.body.innerText),
            espera.source, { timeout: 30000 },
          )
        }
        await preparar(p)
      },
      escribir: async (sel, texto) => {
        const c = p.locator(sel).first()
        await c.click()
        // Letra a letra: tiene que VERSE que alguien escribe.
        await c.type(texto, { delay: 55 })
        await p.waitForTimeout(450)
      },
      seguir: async (rotulo) => {
        await p.locator(`button:has-text("${rotulo}")`).first().click()
        await p.waitForTimeout(1700)
        /* ⚠ EL REGISTRO ADMITE 3 CUENTAS POR HORA Y POR IP, y cada toma crea la
           suya: a partir de la cuarta el asistente se queda en el paso 4 con
           «Demasiados intentos» y la toma graba una pantalla equivocada sin que
           nada falle. El contador vive en memoria del proceso, así que se
           arregla reiniciando el espejo. */
        const texto = await p.evaluate(() => document.body.innerText)
        if (/Demasiados intentos/i.test(texto)) {
          throw new Error(
            'El registro está limitado (3 por hora). Reinicia el espejo:\n' +
            '  bash .auditoria/arrancar-espejo.sh',
          )
        }
      },
    }

    console.log(`· toma ${i + 1}/${TOMAS.length} — ${toma.titulo}`)
    const { rotulos = [], zooms = [] } = (await toma.grabar(util)) || {}

    await ctx.close()

    const pngs = rotulos.length
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/${toma.id}` })
      : []
    mkdirSync(DIR, { recursive: true })
    montarToma({
      entrada: ultimoWebm(dirGrab),
      salida: `${DIR}/${String(i).padStart(2, '0')}-${toma.id}.mp4`,
      zooms,
      rotulos: rotulos.map((r, n) => ({ ...r, ...pngs[n] })),
      desde,
    })
    console.log(`   prólogo recortado: ${desde.toFixed(1)}s`)
  }

  await nav.close()
}

// ── Arranque ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
const soloPegar = args.includes('--pegar')
const iToma = args.indexOf('--toma')

if (!soloPegar) {
  const unaSola = iToma >= 0
  if (!unaSola) {
    vaciar(DIR)
    if (await borrarCuenta()) console.log('· cuenta de la grabación anterior, borrada')
  }
  const indices = unaSola ? [Number(args[iToma + 1]) - 1] : TOMAS.map((_, i) => i)
  if (indices.some((i) => !TOMAS[i])) throw new Error(`toma fuera de rango (hay ${TOMAS.length})`)
  await grabar(indices)
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
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(38)} ${d.toFixed(1)}s`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
if (!soloPegar && iToma < 0) {
  await borrarCuenta()
  console.log('  cuenta de prueba borrada')
}
