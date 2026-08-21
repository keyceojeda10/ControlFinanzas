// scripts/video-demo/v02-cliente-prestamo.mjs
//
// VÍDEO 2 · Crear un cliente y su préstamo
//
//     node scripts/video-demo/v02-cliente-prestamo.mjs            # todo
//     node scripts/video-demo/v02-cliente-prestamo.mjs --toma 5   # solo esa
//     node scripts/video-demo/v02-cliente-prestamo.mjs --pegar
//
// Los rótulos salen de lo que la pantalla dice de verdad, sondeado antes con
// `sondear.mjs`. No se escriben de memoria.
//
// ⚠ Crea un cliente DE VERDAD en el negocio de mentira del espejo. Se borra al
//   empezar cada toma, para que repetir una no acumule «Luis Fernando Ocampo»
//   duplicados en la lista.
//
// ⚠ LOS CAMPOS SE APUNTAN POR SU PLACEHOLDER. No tienen `name` y su `id` lo
//   genera React (`_r_0_`), así que cambia entre renderizados. El placeholder es
//   lo estable y además es lo que el usuario ve. Salieron de `sondear.mjs`, no
//   de suponerlos: escribí `input[name="nombre"]` de memoria y la toma 2 se
//   quedó 30 segundos esperando un campo que no existe.

import { chromium } from 'playwright'
import { mkdirSync, readdirSync } from 'fs'
import { encode } from 'next-auth/jwt'
import { preparar, subrayar, quitarSubrayado } from './efectos.mjs'
import { dibujar } from './rotulos.mjs'
import { montarToma, pegar, ultimoWebm, vaciar, duracion } from './montar-video.mjs'
import { conectar, IDS } from './montar-demo.mjs'

const BASE = 'http://localhost:3016'
const DIR = '/tmp/videos/02-cliente-prestamo'
const FINAL = '/tmp/videos/02-cliente-prestamo.mp4'

const CLIENTE = {
  nombre: 'Luis Fernando Ocampo',
  cedula: '71458203',
  celular: '3012223344',
  direccion: 'Calle 24 · Barrio La Palma',
}
const MONTO = '400000'

const TOMAS = [
  {
    id: 'como',
    titulo: 'Nuevo cliente: a mano o desde una foto',
    async grabar({ p, ir, esperar, empezar }) {
      await ir('/clientes/nuevo', /Nuevo cliente/)
      empezar()
      await esperar(1400)
      const foto = await subrayar(p, 'text=La IA lee la cartulina', { ms: 2600 })
      await quitarSubrayado(p)
      await esperar(700)
      return {
        rotulos: [
          { t: 0.3, dura: 2.6, texto: 'Un cliente se puede crear de dos formas' },
          { t: 3.2, dura: 3.2, texto: 'O le tomas foto a la cartulina y la lee sola' },
        ],
        zooms: [{ t: 3.3, dura: 2.6, escala: 1.9, ...foto }],
      }
    },
  },
  {
    id: 'datos',
    titulo: 'Los datos: solo el nombre es obligatorio',
    async grabar({ p, ir, esperar, escribir, tocar, empezar }) {
      await ir('/clientes/nuevo', /Nuevo cliente/)
      await tocar('Crear manual')
      empezar()
      await esperar(1000)
      const aviso = await subrayar(p, 'text=Solo el nombre es obligatorio', { ms: 2400 })
      await quitarSubrayado(p)
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await esperar(600)
      return {
        rotulos: [
          { t: 0.3, dura: 2.6, texto: 'Con el nombre basta para empezar' },
          { t: 3.4, dura: 2.6, texto: 'Lo demás lo completas cuando lo visites' },
        ],
        zooms: [{ t: 0.4, dura: 2.4, escala: 1.8, ...aviso }],
      }
    },
  },
  {
    id: 'guardar',
    titulo: 'Guardar el cliente',
    async grabar({ p, ir, esperar, escribir, tocar, empezar }) {
      await ir('/clientes/nuevo', /Nuevo cliente/)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      empezar()
      await esperar(900)
      const boton = await subrayar(p, 'button:has-text("Crear cliente")', { ms: 2200 })
      await quitarSubrayado(p)
      await tocar('Crear cliente')
      await esperar(2600)
      return {
        rotulos: [{ t: 0.3, dura: 3.0, texto: 'Cédula y celular ayudan a encontrarlo y a escribirle' }],
        zooms: [{ t: 1.0, dura: 2.2, escala: 1.7, ...boton }],
      }
    },
  },
  {
    id: 'quien',
    titulo: 'El préstamo: a quién',
    async grabar({ p, ir, esperar, empezar }) {
      await ir('/prestamos/nuevo', /Elige el cliente/)
      empezar()
      await esperar(1400)
      const rec = await subrayar(p, 'text=RECIENTES', { ms: 2200 })
      await quitarSubrayado(p)
      await esperar(600)
      return {
        rotulos: [
          { t: 0.3, dura: 2.6, texto: 'Ahora el préstamo: primero, a quién' },
          { t: 3.2, dura: 2.6, texto: 'Los últimos salen de primeras' },
        ],
        zooms: [{ t: 3.3, dura: 2.2, escala: 1.7, ...rec }],
      }
    },
  },
  {
    id: 'cuanto',
    titulo: 'Cuánto y cada cuánto',
    async grabar({ p, ir, esperar, escribir, tocar, empezar }) {
      await ir('/prestamos/nuevo', /Elige el cliente/)
      await tocar(CLIENTE.nombre)
      await tocar('Continuar')
      empezar()
      await esperar(1000)
      const atajos = await subrayar(p, 'button:has-text("500k")', { ms: 2000 })
      await quitarSubrayado(p)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await esperar(800)
      const frec = await subrayar(p, 'button:has-text("Semanal")', { ms: 2200 })
      await quitarSubrayado(p)
      await esperar(600)
      return {
        rotulos: [
          { t: 0.3, dura: 2.4, texto: 'Cuánto le entregas' },
          { t: 2.6, dura: 2.2, texto: 'O tocas un monto de los de siempre' },
          { t: 6.0, dura: 2.8, texto: 'Y cada cuánto le cobras' },
        ],
        zooms: [
          { t: 2.7, dura: 2.0, escala: 1.9, ...atajos },
          { t: 6.1, dura: 2.4, escala: 1.7, ...frec },
        ],
      }
    },
  },
  {
    id: 'interes',
    titulo: 'El interés y las cuotas',
    async grabar({ p, ir, esperar, escribir, tocar, empezar }) {
      await ir('/prestamos/nuevo', /Elige el cliente/)
      await tocar(CLIENTE.nombre)
      await tocar('Continuar')
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(900)
      const tasa = await subrayar(p, 'button:has-text("20%")', { ms: 2200 })
      await quitarSubrayado(p)
      await esperar(700)
      const nose = await subrayar(p, 'button:has-text("No sé")', { ms: 2600 })
      await quitarSubrayado(p)
      await esperar(700)
      return {
        rotulos: [
          { t: 0.3, dura: 2.6, texto: 'El interés, y en cuántas cuotas paga' },
          { t: 3.4, dura: 3.4, texto: 'Si no sabes cuándo te paga, toca «No sé»: queda sin vencimiento' },
        ],
        zooms: [
          { t: 0.4, dura: 2.2, escala: 1.9, ...tasa },
          { t: 3.5, dura: 2.6, escala: 1.9, ...nose },
        ],
      }
    },
  },
  {
    id: 'modo',
    titulo: 'Cómo cobra el interés',
    async grabar({ p, ir, esperar, escribir, tocar, empezar }) {
      await ir('/prestamos/nuevo', /Elige el cliente/)
      await tocar(CLIENTE.nombre)
      await tocar('Continuar')
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(600)
      const reco = await subrayar(p, 'text=RECOMENDADO', { ms: 2600 })
      await quitarSubrayado(p)
      await esperar(600)
      const ayuda = await subrayar(p, 'text=Responde 2 preguntas', { ms: 2800 })
      await quitarSubrayado(p)
      await esperar(700)
      return {
        rotulos: [
          { t: 0.3, dura: 3.2, texto: 'Hay cuatro formas de cobrar el interés' },
          { t: 3.6, dura: 2.8, texto: 'La de siempre es «cuota fija»: la misma cuota cada vez' },
          { t: 6.8, dura: 3.2, texto: 'Y si dudas, el sistema te pregunta dos cosas y elige por ti' },
        ],
        zooms: [
          { t: 3.7, dura: 2.4, escala: 1.8, ...reco },
          { t: 6.9, dura: 2.6, escala: 1.8, ...ayuda },
        ],
      }
    },
  },
]

// ── El cliente de la demostración no se acumula ────────────────────────────
const borrarCliente = async () => {
  const cx = await conectar()
  const [filas] = await cx.query(
    'SELECT id FROM Cliente WHERE organizationId = ? AND nombre = ?', [IDS.org, CLIENTE.nombre])
  for (const f of filas) {
    await cx.execute('DELETE FROM Pago WHERE prestamoId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM MovimientoCapital WHERE referenciaId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM CuotaAmortizacion WHERE prestamoId IN (SELECT id FROM Prestamo WHERE clienteId = ?)', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Prestamo WHERE clienteId = ?', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Cliente WHERE id = ?', [f.id]).catch(() => {})
  }
  await cx.end()
  return filas.length
}

/* Para las tomas del préstamo hace falta que el cliente EXISTA. Se crea por el
   endpoint real, no por SQL: si se insertara a mano, el vídeo enseñaría un
   cliente que el sistema nunca produjo. */
const crearCliente = async () => {
  const t = await encode({
    token: {
      sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo',
      rol: 'owner', organizationId: IDS.org, plan: 'professional', country: 'co',
      orgNombre: 'Créditos del Valle', rutaIds: [],
    },
    secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
  })
  await fetch(`${BASE}/api/clientes`, {
    method: 'POST',
    headers: { cookie: `next-auth.session-token=${t}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: CLIENTE.nombre, cedula: CLIENTE.cedula, telefono: CLIENTE.celular,
      direccion: CLIENTE.direccion, rutaId: IDS.ruta,
    }),
  })
}

async function grabar(indices) {
  const nav = await chromium.launch()

  for (const i of indices) {
    const toma = TOMAS[i]
    const dirGrab = `/tmp/grab-02/${toma.id}`
    vaciar(dirGrab)

    // Las tres primeras tomas CREAN el cliente; las demás lo necesitan hecho.
    await borrarCliente()
    if (i > 2) await crearCliente()

    const t = await encode({
      token: {
        sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo',
        rol: 'owner', organizationId: IDS.org, plan: 'professional', country: 'co',
        orgNombre: 'Créditos del Valle', rutaIds: [],
      },
      secret: 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c',
    })
    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
    })
    await ctx.addCookies([{ name: 'next-auth.session-token', value: t, domain: 'localhost', path: '/' }])
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0

    const util = {
      p,
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
        await p.waitForTimeout(900)
        await preparar(p)
      },
      escribir: async (sel, texto) => {
        const c = p.locator(sel).first()
        await c.click()
        await c.type(texto, { delay: 55 })
        await p.waitForTimeout(450)
      },
      tocar: async (texto) => {
        await p.locator(`button:has-text("${texto}"), [role="button"]:has-text("${texto}")`)
          .first().click({ timeout: 8000 })
        await p.waitForTimeout(1600)
      },
    }

    console.log(`· toma ${i + 1}/${TOMAS.length} — ${toma.titulo}`)
    const { rotulos = [], zooms = [] } = (await toma.grabar(util)) || {}
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
    console.log(`   prólogo recortado: ${desde.toFixed(1)}s`)
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
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(42)} ${d.toFixed(1)}s`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
