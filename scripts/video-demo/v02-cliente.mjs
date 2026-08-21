// scripts/video-demo/v02-cliente.mjs
//
// VÍDEO 2 · Crear un cliente
//
// ── LAS REGLAS QUE SALIERON DE REHACERLO DOS VECES ─────────────────────────
//
// 1. NUNCA se entra por URL a una pantalla que el vídeo va a explicar. Se llega
//    tocando, y se enseña dónde se toca. («No pulsas el botón de donde la gente
//    encuentra el crear el cliente.»)
// 2. Una sección de pantalla, una parada.
// 3. LAS PAUSAS SON LARGAS A PROPÓSITO, y no es estética: la voz se graba
//    encima. «Si es muy rápido, después la voz toca ponerla o muy rápido o va a
//    salir audio desfasado del vídeo.» Cada parada se calcula contra el texto
//    que hay que decir, a ~2,4 palabras por segundo, más aire.
// 4. Un acercamiento por parada. Dos seguidos se ven como un tirón.
//
// ── LOS TIEMPOS NO SE CALCULAN A MANO ──────────────────────────────────────
//
// `decir()` y `mirar()` anotan el instante REAL en que ocurren. Antes los
// escribía yo en el guion y bastaba tocar una espera para que la voz quedara
// desfasada del rótulo.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'fs'
import { encode } from 'next-auth/jwt'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'
import { conectar, IDS } from './montar-demo.mjs'

const BASE = 'http://localhost:3016'
const DIR = '/tmp/videos/02-cliente'
const FINAL = '/tmp/videos/02-cliente.mp4'

const CLIENTE = {
  nombre: 'Luis Fernando Ocampo',
  cedula: '71458203',
  celular: '3012223344',
  direccion: 'Calle 24 · Barrio La Palma',
  referencia: 'Frente a la panadería',
}

const TOMAS = [
  {
    id: 'panel',
    titulo: 'El panel y el botón Crear',
    async grabar({ ir, esperar, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      empezar()
      await decir('Este es tu panel. Es lo primero que ves al entrar', 4.2)
      await esperar(4400)
      await mirar('button[aria-label="Crear"]', { escala: 2.2, ms: 3600 })
      await decir('Abajo a la derecha, el botón del más', 3.8)
      await esperar(4000)
    },
  },
  {
    id: 'menu',
    titulo: 'El menú: ¿qué vas a hacer?',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await esperar(1200)
      empezar()
      await decir('Al tocarlo se abre todo lo que puedes hacer', 4.0)
      await tocar('Crear')
      await esperar(4200)
      await decir('Arriba lo que hace entrar plata, abajo lo que la hace salir', 4.6)
      await esperar(4800)
      await mirar('text=Un cliente nuevo', { escala: 1.9, ms: 4000 })
      await decir('Y aquí, para meter un cliente nuevo', 3.8)
      await esperar(4000)
    },
  },
  {
    id: 'como',
    titulo: 'Dos formas de crearlo',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear')
      await esperar(1500)
      await tocar('Un cliente nuevo')
      empezar()
      await decir('Hay dos maneras de meterlo', 3.4)
      await esperar(3800)
      await mirar('text=Escribe los datos del cliente', { escala: 1.8, ms: 3800 })
      await decir('Escribir tú los datos, uno por uno', 3.8)
      await esperar(4200)
      await mirar('text=La IA lee la cartulina', { escala: 1.8, ms: 4200 })
      await decir('O tomarle foto a la cartulina y que el sistema la lea', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'quien',
    titulo: 'Quién es tu cliente',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      empezar()
      await decir('Lo primero es quién es', 3.2)
      await esperar(3600)
      await mirar('text=Solo el nombre es obligatorio', { escala: 1.8, ms: 4400 })
      await decir('Con el nombre basta: es lo único obligatorio', 4.2)
      await esperar(4600)
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await decir('Lo escribes y ya tienes cliente', 3.6)
      await esperar(3800)
    },
  },
  {
    id: 'contacto',
    titulo: 'Cédula y celular',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await decir('La cédula no hace falta, pero sirve para encontrarlo rápido', 4.6)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await esperar(3400)
      await decir('Y con el celular le mandas el recibo por WhatsApp', 4.4)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await esperar(3800)
    },
  },
  {
    id: 'donde',
    titulo: 'Dónde lo ubicamos',
    async grabar({ ir, esperar, tocar, escribir, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await decir('Ahora dónde vive, para poder visitarlo', 4.0)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await esperar(3200)
      await decir('La referencia ayuda al cobrador a dar con la casa', 4.4)
      await escribir('input[placeholder*="frente al colegio"]', CLIENTE.referencia)
      await esperar(3600)
      await mirar('text=UBICACIÓN EN EL MAPA', { escala: 1.7, ms: 4000 })
      await decir('Y si quieres, le marcas el punto en el mapa', 4.0)
      await esperar(4200)
    },
  },
  {
    id: 'ruta',
    titulo: 'A qué ruta pertenece',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await mirar('text=¿Lo asignamos a una ruta?', { escala: 1.7, ms: 4200 })
      await decir('Puedes ponerlo en una ruta desde ya', 4.0)
      await esperar(4400)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      await decir('También es opcional: se la asignas después cuando quieras', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'crear',
    titulo: 'Crear el cliente',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, decir, mirar }) {
      await ir('/dashboard', /Recaudado|Buenos|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      empezar()
      await mirar('button:has-text("Crear cliente")', { escala: 1.7, ms: 3800 })
      await decir('Cuando esté listo, «Crear cliente»', 3.8)
      await esperar(4000)
      await tocar('Crear cliente')
      await esperar(3400)
      await decir('Y ya lo tienes en tu lista, listo para prestarle', 4.6)
      await esperar(4800)
    },
  },
]

const borrarCliente = async () => {
  const cx = await conectar()
  const [filas] = await cx.query(
    'SELECT id FROM Cliente WHERE organizationId = ? AND nombre = ?', [IDS.org, CLIENTE.nombre])
  for (const f of filas) {
    await cx.execute('DELETE FROM Pago WHERE prestamoId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM MovimientoCapital WHERE referenciaId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Prestamo WHERE clienteId = ?', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Cliente WHERE id = ?', [f.id]).catch(() => {})
  }
  await cx.end()
  return filas.length
}

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
    const dirGrab = `/tmp/grab-02/${toma.id}`
    vaciar(dirGrab)
    await borrarCliente()

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

      /** Un rótulo, anclado al instante REAL en que se dice. */
      decir: async (texto, dura = 3.6) => { rotulos.push({ t: Math.max(0, ahora()), dura, texto }) },

      /** Subraya y se acerca, también en el instante real. */
      mirar: async (sel, { escala = 1.8, ms = 3600 } = {}) => {
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
            (re) => new RegExp(re).test(document.body.innerText),
            espera.source, { timeout: 30000 },
          ).catch(() => {})
        }
        await p.waitForTimeout(1400)
        /* ⚠ NO GRABAR UNA PANTALLA VACÍA. Pasó con el panel: el negocio se monta
           por SQL y sin la marca de onboarding terminado el `main` se queda con
           tres nodos, sin que nada falle. El vídeo salía con el rótulo «Este es
           tu panel» sobre un gris. */
        const texto = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
        if (texto.length < 60) {
          throw new Error(
            `La pantalla ${ruta} se quedó vacía (${texto.length} caracteres).\n` +
            'Reinicia el espejo o revisa el negocio de demostración.',
          )
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
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/02-${toma.id}` })
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
  await borrarCliente()
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
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(30)} ${d.toFixed(1)}s`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
