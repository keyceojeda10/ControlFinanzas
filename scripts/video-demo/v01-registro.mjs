// scripts/video-demo/v01-registro.mjs
//
// VÍDEO 1 · Cómo registrarse en el sistema
//
//     node scripts/video-demo/v01-registro.mjs            # todas y pega
//     node scripts/video-demo/v01-registro.mjs --toma 3   # solo la 3
//     node scripts/video-demo/v01-registro.mjs --pegar
//
// ── SE REHIZO PARA IGUALAR EL RITMO DEL VÍDEO 2 ────────────────────────────
//
// La primera versión iba a 6,3 segundos por bloque; el vídeo 2, ya aprobado, va
// a 13,9. Con la voz encima, la mitad de tiempo significa leer atropellado o
// quedar desfasado. Mismo contenido, el doble de aire.
//
// Reglas (las mismas para todos los vídeos):
//   1. No se entra por URL a una pantalla que el vídeo explica.
//   2. Una sección, una parada.
//   3. Las pausas se calculan contra lo que hay que decir: ~2,4 palabras por
//      segundo, más aire.
//   4. Un acercamiento por parada. El montaje avisa si quedan pegados.
//
// ⚠ Se registra una cuenta DE VERDAD, en el espejo, con un correo de
//   `ejemplo.com` (reservado por norma para documentación). Se borra antes y
//   después.
//
// ⚠ El registro admite 3 cuentas por hora y por IP. Cada toma crea la suya, así
//   que hay que REINICIAR EL ESPEJO antes de grabar entero:
//       bash .auditoria/arrancar-espejo.sh

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

const TOMAS = [
  {
    id: 'entrada',
    titulo: 'La pantalla de registro',
    async grabar({ ir, esperar, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      empezar()
      await decir('Crear tu cuenta son cuatro pasos', 4.0)
      await esperar(4400)
      await mirar('text=Paso 1 de 4', { escala: 1.8, ms: 3800 })
      await decir('Arriba te va diciendo por cuál vas', 3.8)
      await esperar(4000)
    },
  },
  {
    id: 'nombre',
    titulo: 'Paso 1 · tu nombre',
    async grabar({ ir, esperar, escribir, seguir, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      empezar()
      await mirar('input[type="text"]', { escala: 1.9, ms: 3800 })
      await decir('Lo primero, tu nombre', 3.4)
      await esperar(3800)
      await escribir('input[type="text"]', DATOS.nombre)
      await decir('Es el que verás dentro de la aplicación', 4.0)
      await esperar(4200)
      await seguir('Continuar')
      await esperar(1600)
    },
  },
  {
    id: 'negocio',
    titulo: 'Paso 2 · el negocio',
    async grabar({ ir, esperar, escribir, seguir, empezar, decir }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre)
      await seguir('Continuar')
      empezar()
      await decir('Ahora el nombre de tu negocio', 3.6)
      await esperar(4000)
      await escribir('input[type="text"]', DATOS.negocio)
      await decir('Este sí importa: es el que ven tus clientes y tus cobradores', 4.8)
      await esperar(5000)
      await seguir('Continuar')
      await esperar(1600)
    },
  },
  {
    id: 'whatsapp',
    titulo: 'Paso 3 · país y WhatsApp',
    async grabar({ ir, esperar, escribir, seguir, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      empezar()
      await mirar('select', { escala: 1.7, ms: 4200 })
      await decir('Eliges tu país: el sistema trabaja en doce', 4.2)
      await esperar(4600)
      await escribir('input[type="tel"]', DATOS.telefono)
      await decir('Y tu WhatsApp: por ahí te llega el código para verificar', 4.8)
      await esperar(5000)
      await seguir('Continuar')
      await esperar(1600)
    },
  },
  {
    id: 'cuenta',
    titulo: 'Paso 4 · correo y contraseña',
    async grabar({ ir, esperar, escribir, seguir, empezar, decir }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      empezar()
      await decir('El último paso son tus datos de entrada', 4.0)
      await esperar(4200)
      await escribir('input[type="email"]', CORREO)
      await decir('El correo va a ser tu usuario: pon uno al que entres de verdad', 4.8)
      await esperar(4600)
      await escribir('input[type="password"]', DATOS.clave)
      await decir('Y una contraseña de mínimo ocho caracteres', 4.0)
      await esperar(4400)
    },
  },
  {
    id: 'terminos',
    titulo: 'La casilla de los términos',
    async grabar({ p, ir, esperar, escribir, seguir, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', DATOS.clave)
      empezar()
      /* Es donde más gente se traba: el botón no hace nada hasta marcarla, y no
         lo dice. Merece su propia parada. */
      await mirar('input[type="checkbox"]', { escala: 2.2, ms: 4600 })
      await decir('Ojo con este cuadrito: hay que aceptar los términos', 4.4)
      await esperar(4800)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await decir('Si no lo marcas, el botón de abajo no te deja seguir', 4.6)
      await esperar(4800)
    },
  },
  {
    id: 'crear',
    titulo: 'Crear la cuenta',
    async grabar({ p, ir, esperar, escribir, seguir, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', DATOS.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      empezar()
      await mirar('button:has-text("Crear cuenta gratis")', { escala: 1.7, ms: 4000 })
      await decir('Y ya está: «Crear cuenta gratis»', 3.8)
      await esperar(4200)
      await seguir('Crear cuenta gratis')
      await esperar(2600)
      await decir('Catorce días completos, sin poner ninguna tarjeta', 4.4)
      await esperar(4600)
    },
  },
  {
    id: 'verificar',
    titulo: 'La verificación',
    async grabar({ p, ir, esperar, escribir, seguir, empezar, decir, mirar }) {
      await ir('/registro', /Paso 1 de 4/)
      await escribir('input[type="text"]', DATOS.nombre); await seguir('Continuar')
      await escribir('input[type="text"]', DATOS.negocio); await seguir('Continuar')
      await escribir('input[type="tel"]', DATOS.telefono); await seguir('Continuar')
      await escribir('input[type="email"]', CORREO)
      await escribir('input[type="password"]', DATOS.clave)
      await p.locator('input[type="checkbox"]').first().check().catch(() => {})
      await seguir('Crear cuenta gratis')
      await esperar(3400)
      empezar()
      await decir('Al terminar te llega un código de seis dígitos por WhatsApp', 4.8)
      await esperar(5000)
      try {
        await mirar('button:has-text("Verificar por correo")', { escala: 1.8, ms: 4000 })
        await decir('Si no te llega, puedes pedirlo al correo', 4.0)
        await esperar(4400)
      } catch { /* si cambia el rótulo, la toma sigue sin ese acercamiento */ }
      await decir('Y si tienes prisa, entras ya y verificas después', 4.4)
      await esperar(4600)
    },
  },
]

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

async function grabar(indices) {
  const nav = await chromium.launch()

  for (const i of indices) {
    const toma = TOMAS[i]
    const dirGrab = `/tmp/grab-01/${toma.id}`
    vaciar(dirGrab)
    await borrarCuenta()

    const ctx = await nav.newContext({
      viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
      recordVideo: { dir: dirGrab, size: { width: 540, height: 960 } },
    })
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
      decir: async (texto, dura = 3.8) => { rotulos.push({ t: Math.max(0, ahora()), dura, texto }) },
      mirar: async (sel, { escala = 1.8, ms = 3800 } = {}) => {
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
        await c.type(texto, { delay: 62 })
        await p.waitForTimeout(700)
      },
      seguir: async (rotulo) => {
        await p.locator(`button:has-text("${rotulo}")`).first().click()
        await p.waitForTimeout(1800)
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
    await toma.grabar(util)
    await ctx.close()

    const pngs = rotulos.length
      ? await dibujar(rotulos.map((r) => r.texto), { dir: `/tmp/cf-rotulos/01-${toma.id}` })
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
  await borrarCuenta()
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
  console.log(`  ${m}:${sg}  ${(toma?.titulo || id).padEnd(30)} ${d.toFixed(1)}s  · caben ~${Math.floor(d * 2.4)} palabras`)
  reloj += d
}
const mf = String(Math.floor(reloj / 60)).padStart(2, '0')
const sf = String(Math.floor(reloj % 60)).padStart(2, '0')
console.log(`  ${mf}:${sf}  (fin)`)
