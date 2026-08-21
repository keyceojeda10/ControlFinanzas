// scripts/video-demo/v02-cliente.mjs
//
// VÍDEO 2 · Crear un cliente
//
// ── POR QUÉ ESTE VÍDEO SE REHIZO ENTERO ────────────────────────────────────
//
// El primer intento no servía, y el dueño lo dijo sin rodeos:
//
//   «Primero no pulsas el botón de donde la gente encuentra el crear el
//    cliente. Empezaste enseguida en la pantalla del cliente sin ni siquiera
//    haber pulsado cómo llegar. Está muy rápido, te está saltando muchos pasos.
//    Hay que ser mucho más explicativo y descriptivo con cada sección.»
//
// Tenía razón: yo navegaba por URL directa, que es como llega un programador,
// no un usuario. Un tutorial empieza donde empieza la persona —el panel— y toca
// los mismos botones que va a tocar ella.
//
// Reglas que salen de ahí, y que valen para TODOS los vídeos:
//
//   1. NUNCA se entra por URL a una pantalla que el vídeo va a explicar. Se
//      llega tocando, y se enseña dónde se toca.
//   2. Una sección de pantalla, una parada. Nada de recorrer tres cosas en
//      cuatro segundos.
//   3. Las pausas son largas a propósito. Quien narra necesita sitio, y quien
//      mira necesita leer.
//   4. El préstamo va en su propio vídeo (`v03-prestamo.mjs`). Meterlo aquí es
//      lo que obligaba a correr.

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
    titulo: 'Dónde se empieza: el botón Crear',
    async grabar({ p, ir, esperar, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      empezar()
      await esperar(2200)
      /* ⚠ EL BOTÓN «CREAR» NO TIENE TEXTO. Ni él ni la pastilla de navegación: son
   iconos, y el rótulo vive en `aria-label`. Buscarlo por texto falla. */
      await subrayarY('button[aria-label="Crear"]', 2.4, { escala: 2.2, ms: 3000 })
      await esperar(1400)
      return {
        rotulos: [
          { t: 0.4, dura: 3.4, texto: 'Este es tu panel. Todo empieza aquí' },
          { t: 4.2, dura: 3.6, texto: 'Abajo a la derecha está el botón «Crear»' },
        ],
      }
    },
  },
  {
    id: 'menu',
    titulo: 'El menú: ¿qué vas a hacer?',
    async grabar({ p, ir, esperar, tocar, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await esperar(1200)
      empezar()
      await tocar('Crear')
      await esperar(2600)
      await subrayarY('text=Un cliente nuevo', 5.0, { escala: 1.9, ms: 3200 })
      await esperar(1400)
      return {
        rotulos: [
          { t: 1.2, dura: 3.4, texto: 'Al tocarlo se abre todo lo que puedes hacer' },
          { t: 5.0, dura: 3.6, texto: 'Para meter un cliente: «Un cliente nuevo»' },
        ],
      }
    },
  },
  {
    id: 'como',
    titulo: 'Dos formas de crearlo',
    async grabar({ p, ir, esperar, tocar, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear')
      await esperar(1500)
      await tocar('Un cliente nuevo')
      empezar()
      await esperar(2400)
      await subrayarY('text=Escribe los datos del cliente', 3.0, { escala: 1.8, ms: 3000 })
      await esperar(800)
      await subrayarY('text=La IA lee la cartulina', 7.0, { escala: 1.8, ms: 3200 })
      await esperar(1200)
      return {
        rotulos: [
          { t: 0.4, dura: 2.6, texto: 'Hay dos maneras de meterlo' },
          { t: 3.0, dura: 3.6, texto: 'Escribir los datos tú mismo, uno por uno' },
          { t: 7.0, dura: 4.0, texto: 'O tomarle foto a la cartulina y que el sistema la lea' },
        ],
      }
    },
  },
  {
    id: 'quien',
    titulo: 'Quién es tu cliente',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      empezar()
      await esperar(2200)
      await subrayarY('text=Solo el nombre es obligatorio', 2.8, { escala: 1.8, ms: 3400 })
      await esperar(900)
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await esperar(1800)
      return {
        rotulos: [
          { t: 0.4, dura: 2.4, texto: 'Primero, quién es' },
          { t: 2.8, dura: 4.0, texto: 'Con el nombre basta: es lo único obligatorio' },
          { t: 7.4, dura: 3.4, texto: 'Lo escribes y ya tienes cliente' },
        ],
      }
    },
  },
  {
    id: 'contacto',
    titulo: 'Cédula y celular',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await esperar(1600)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await esperar(1800)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await esperar(2000)
      return {
        rotulos: [
          { t: 0.4, dura: 3.6, texto: 'La cédula no es obligatoria, pero sirve para encontrarlo rápido' },
          { t: 4.6, dura: 4.0, texto: 'Y con el celular le mandas el recibo por WhatsApp' },
        ],
      }
    },
  },
  {
    id: 'donde',
    titulo: 'Dónde lo ubicamos',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await esperar(1400)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await esperar(1600)
      await escribir('input[placeholder*="frente al colegio"]', CLIENTE.referencia)
      await esperar(1600)
      await subrayarY('text=UBICACIÓN EN EL MAPA', 6.6, { escala: 1.7, ms: 3200 })
      await esperar(1200)
      return {
        rotulos: [
          { t: 0.4, dura: 3.4, texto: 'Ahora dónde vive, para poder visitarlo' },
          { t: 3.4, dura: 3.0, texto: 'La referencia ayuda al cobrador a dar con la casa' },
          { t: 6.6, dura: 3.8, texto: 'Y si quieres, le marcas el punto exacto en el mapa' },
        ],
      }
    },
  },
  {
    id: 'ruta',
    titulo: 'A qué ruta pertenece',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      empezar()
      await esperar(1200)
      await subrayarY('text=¿Lo asignamos a una ruta?', 1.6, { escala: 1.7, ms: 3400 })
      await esperar(1000)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      await esperar(2400)
      return {
        rotulos: [
          { t: 0.3, dura: 3.6, texto: 'Puedes ponerlo en una ruta desde ya' },
          { t: 4.2, dura: 4.0, texto: 'También es opcional: se lo asignas después cuando quieras' },
        ],
      }
    },
  },
  {
    id: 'crear',
    titulo: 'Crear el cliente',
    async grabar({ p, ir, esperar, tocar, escribir, empezar, subrayarY }) {
      await ir('/dashboard', /Recaudado|Hoy|Panel/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Un cliente nuevo'); await esperar(1500)
      await tocar('Crear manual')
      await escribir('input[placeholder*="Juan García"]', CLIENTE.nombre)
      await escribir('input[placeholder*="1023456789"]', CLIENTE.cedula)
      await escribir('input[placeholder*="3001234567"]', CLIENTE.celular)
      await escribir('input[placeholder*="Calle, barrio"]', CLIENTE.direccion)
      await p.locator('select').first().selectOption({ label: 'Ruta Centro' }).catch(() => {})
      empezar()
      await esperar(1600)
      await subrayarY('button:has-text("Crear cliente")', 1.8, { escala: 1.7, ms: 3000 })
      await esperar(700)
      await tocar('Crear cliente')
      await esperar(4200)
      return {
        rotulos: [
          { t: 0.4, dura: 3.2, texto: 'Cuando esté listo, «Crear cliente»' },
          { t: 6.0, dura: 4.0, texto: 'Y ya lo tienes en tu lista, listo para prestarle' },
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
    await cx.execute('DELETE FROM Prestamo WHERE clienteId = ?', [f.id]).catch(() => {})
    await cx.execute('DELETE FROM Cliente WHERE id = ?', [f.id]).catch(() => {})
  }
  await cx.end()
  return filas.length
}

async function grabar(indices) {
  const nav = await chromium.launch()
  const t = await encode({
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
    await ctx.addCookies([{ name: 'next-auth.session-token', value: t, domain: 'localhost', path: '/' }])
    const p = await ctx.newPage()
    const t0 = Date.now()
    let desde = 0
    const zooms = []

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
          ).catch(() => {})
        }
        await p.waitForTimeout(1200)

        /* ⚠ NO GRABAR UNA PANTALLA VACÍA. Pasó con el panel: los límites
           anti-abuso del espejo devolvían 429 en `/api/offline/sync` de tanto
           grabar, el panel se quedaba en blanco y el vídeo salía con el rótulo
           «Este es tu panel. Todo empieza aquí» sobre una pantalla gris. Nada
           fallaba; simplemente el resultado era inservible.
           Se arregla reiniciando el espejo, y esta guarda lo dice. */
        const texto = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim())
        if (texto.length < 60) {
          throw new Error(
            `La pantalla ${ruta} se quedó vacía (${texto.length} caracteres).\n` +
            'Suele ser el límite de peticiones del espejo. Reinícialo:\n' +
            '  bash .auditoria/arrancar-espejo.sh',
          )
        }
        await preparar(p)
      },
      escribir: async (sel, texto) => {
        const c = p.locator(sel).first()
        await c.click()
        await c.type(texto, { delay: 60 })
        await p.waitForTimeout(600)
      },
      tocar: async (texto) => {
        // Por texto O por `aria-label`: los iconos de la pastilla no llevan texto.
        await p.locator(
          `button:has-text("${texto}"), a:has-text("${texto}"), [role="button"]:has-text("${texto}"), ` +
          `[aria-label="${texto}"]`,
        ).first().click({ timeout: 10000 })
        await p.waitForTimeout(1800)
        await preparar(p).catch(() => {})
      },
      /* Subraya y de paso apunta el acercamiento: el instante se da a mano
         porque es el mismo que el del rótulo que lo acompaña. */
      subrayarY: async (sel, t, { escala = 1.8, ms = 2600 } = {}) => {
        const caja = await subrayar(p, sel, { ms })
        zooms.push({ t, dura: Math.max(2.2, ms / 1000 - 0.4), escala, ...caja })
        await quitarSubrayado(p)
        return caja
      },
    }

    console.log(`· toma ${i + 1}/${TOMAS.length} — ${toma.titulo}`)
    const { rotulos = [] } = (await toma.grabar(util)) || {}
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
    console.log(`   prólogo recortado: ${desde.toFixed(1)}s · acercamientos: ${zooms.length}`)
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
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(34)} ${d.toFixed(1)}s`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
