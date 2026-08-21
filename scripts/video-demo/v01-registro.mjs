// scripts/video-demo/v01-registro.mjs
//
// VÍDEO 1 · Cómo registrarse en el sistema
//
// Se graba el asistente real de `/registro`, los cuatro pasos, con los rótulos
// que la pantalla dice de verdad. La narración va aparte, en `v01-registro.md`,
// cronometrada contra las pausas de aquí abajo: si se cambia un tiempo hay que
// cambiar el guion.
//
// ⚠ Se registra una cuenta DE VERDAD, pero en el espejo y con datos inventados
//   —correo `@ejemplo.invalid`, que por norma no existe—. Al final se borra.

import { chromium } from 'playwright'
import { preparar, rotular, quitarRotulo, subrayar, quitarSubrayado, apuntador } from './efectos.mjs'
import { montar, ultimoWebm } from './montar-video.mjs'
import { conectar } from './montar-demo.mjs'

const BASE = 'http://localhost:3016'
const SALIDA = process.env.SALIDA || '/tmp/videos/01-registro.mp4'
/* ⚠ UN CORREO QUE SE PUEDA LEER EN PANTALLA. Llevaba un `Date.now()` para que
   fuera único y en el vídeo salía «nuevo.negocio.1787293124606@ejemplo.invalid»:
   nadie escribe eso, y lo ve un cliente que está decidiendo si compra.
   `ejemplo.com` está reservado por norma (RFC 2606) justo para documentación,
   así que no es de nadie. La unicidad se consigue borrando antes, no ensuciando
   el correo. */
const CORREO = 'carlos.mejia@ejemplo.com'

const DATOS = {
  nombre: 'Carlos Andrés Mejía',
  negocio: 'Créditos La Cosecha',
  telefono: '3009998877',
  clave: 'MiClaveSegura2026',
}

/* Se borra ANTES: si quedó de una grabación anterior, el registro fallaría con
   «ese correo ya está registrado» a mitad del vídeo. */
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
if (await borrarCuenta()) console.log('· cuenta de la grabación anterior, borrada')

const nav = await chromium.launch()
const ctx = await nav.newContext({
  viewport: { width: 540, height: 960 }, deviceScaleFactor: 2, serviceWorkers: 'block',
  recordVideo: { dir: '/tmp/grab-01', size: { width: 540, height: 960 } },
})
const p = await ctx.newPage()
const t0 = Date.now()
const ap = apuntador(t0)

/* ── LA ESCALETA SE ANOTA SOLA ─────────────────────────────────────────────
   El guion de narración tiene que cuadrar al segundo con lo que se ve, y
   calcularlo sumando pausas a mano se desincroniza a la primera que se toque
   una espera. Cada momento se apunta con su instante real y al final se
   imprime la escaleta. */
const escaleta = []
const hito = (que) => { escaleta.push({ t: (Date.now() - t0) / 1000, que }); }

/* Escribir letra a letra, no `fill()`: en el vídeo tiene que VERSE que alguien
   está escribiendo. `fill` planta el texto de golpe y parece un pegado. */
const escribir = async (selector, texto) => {
  const c = p.locator(selector).first()
  await c.click()
  await c.type(texto, { delay: 55 })
  await p.waitForTimeout(500)
}

const seguir = async (rotulo) => {
  const b = p.locator(`button:has-text("${rotulo}")`).first()
  await b.click()
  await p.waitForTimeout(1800)
}

// ── 0 · La pantalla de entrada ─────────────────────────────────────────────
await p.goto(`${BASE}/registro`, { waitUntil: 'domcontentloaded' })
await p.waitForFunction(() => /Paso 1 de 4/.test(document.body.innerText), null, { timeout: 30000 })
await p.waitForTimeout(1500)
await preparar(p)

hito('entra a /registro · Paso 1 de 4')
await rotular(p, 'Crear tu cuenta son cuatro pasos', { ms: 2600 })
await quitarRotulo(p)

// ── 1 · Tu nombre ──────────────────────────────────────────────────────────
hito('PASO 1 · tu nombre')
ap.apuntar(await subrayar(p, 'input[type="text"]', {
  texto: 'Primero, tu nombre', ms: 2000,
}), { escala: 2.0, dura: 2.2 })
await quitarSubrayado(p)
await escribir('input[type="text"]', DATOS.nombre)
await seguir('Continuar')

// ── 2 · El negocio ─────────────────────────────────────────────────────────
hito('PASO 2 · el nombre del negocio')
await rotular(p, 'El nombre de tu negocio: es el que ven tus clientes y tus cobradores', { ms: 3000 })
await quitarRotulo(p)
await escribir('input[type="text"]', DATOS.negocio)
await seguir('Continuar')

// ── 3 · WhatsApp y país ────────────────────────────────────────────────────
hito('PASO 3 · país y WhatsApp')
ap.apuntar(await subrayar(p, 'select', {
  texto: 'Elige tu país. El sistema funciona en 12 países', ms: 2800,
}), { escala: 2.2, dura: 2.4 })
await quitarSubrayado(p)
await escribir('input[type="tel"]', DATOS.telefono)
await rotular(p, 'Tu WhatsApp: por ahí se verifica la cuenta', { ms: 2200 })
await quitarRotulo(p)
await seguir('Continuar')

// ── 4 · Correo, contraseña y términos ──────────────────────────────────────
hito('PASO 4 · correo y contraseña')
await rotular(p, 'Tu correo será tu usuario para entrar', { ms: 2400 })
await quitarRotulo(p)
await escribir('input[type="email"]', CORREO)
await escribir('input[type="password"]', DATOS.clave)
await p.waitForTimeout(400)

/* ⚠ SIN LA CASILLA NO PASA. El guion de sondeo se quedó dando vueltas en el
   paso 4 porque el botón no hace nada hasta aceptar los términos, y eso hay
   que enseñarlo: es donde la gente se atasca. */
hito('la casilla de términos')
ap.apuntar(await subrayar(p, 'input[type="checkbox"]', {
  texto: 'Acepta los términos: sin esto el botón no funciona', ms: 2600, margen: 12,
}), { escala: 2.4, dura: 2.4 })
await p.locator('input[type="checkbox"]').first().check().catch(() => {})
await p.waitForTimeout(700)
await quitarSubrayado(p)

hito('botón Crear cuenta gratis')
ap.apuntar(await subrayar(p, 'button:has-text("Crear cuenta gratis")', {
  texto: 'Y listo: catorce días gratis, sin tarjeta', ms: 2600,
}), { escala: 1.8, dura: 2.4 })
await quitarSubrayado(p)
await seguir('Crear cuenta gratis')

// ── 5 · Lo que sale después ────────────────────────────────────────────────
await p.waitForTimeout(3500)
const despues = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').trim().slice(0, 220))
console.log('DESPUÉS DE CREAR:', despues)

/* ⚠ AQUÍ NO SE ACABA, Y EL PRIMER MONTAJE MENTÍA. Ponía «ya estás dentro» y lo
   que sale es la verificación: un código de 6 dígitos por WhatsApp, con la
   opción de recibirlo por correo o saltarla. Es justo donde la gente se
   atasca, así que se enseña. */
hito('la verificación por WhatsApp')
await rotular(p, 'Te llega un código por WhatsApp', { ms: 2600 })
await quitarRotulo(p)
// `apuntar` no devuelve promesa: el `.catch?.()` que puse reventaba aquí.
try {
  ap.apuntar(await subrayar(p, 'button:has-text("Verificar por correo")', {
    texto: 'Si no te llega, pídelo por correo', ms: 2600,
  }), { escala: 2.0, dura: 2.4 })
} catch { /* si el botón cambia de rótulo, el vídeo sigue sin ese subrayado */ }
await quitarSubrayado(p)
await rotular(p, 'O entra ya y verifica después', { ms: 2400 })
await p.waitForTimeout(900)

await ctx.close()
await nav.close()

// ── Montaje ────────────────────────────────────────────────────────────────
import { mkdirSync } from 'fs'
mkdirSync('/tmp/videos', { recursive: true })
montar({ entrada: ultimoWebm('/tmp/grab-01'), salida: SALIDA, marcas: ap.marcas })
console.log('\n✓ vídeo:', SALIDA)
console.log('  acercamientos:', ap.marcas.length)
console.log('\n── ESCALETA ──')
for (const h of escaleta) {
  const m = String(Math.floor(h.t / 60)).padStart(2, '0')
  const sg = String(Math.floor(h.t % 60)).padStart(2, '0')
  console.log(`  ${m}:${sg}  ${h.que}`)
}

// ── Limpieza: la cuenta de mentira no se queda ─────────────────────────────
await borrarCuenta()
console.log('  cuenta de prueba borrada')
