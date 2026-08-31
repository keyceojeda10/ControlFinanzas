// scripts/capturar-tutoriales.mjs — rehace las 18 capturas de los tutoriales.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
//
// Las 18 imágenes de `public/tutoriales/` eran TODAS del 14 de marzo de 2026, y
// el rediseño empezó en julio. La del panel enseñaba tema oscuro, seis tarjetas
// de colores y la barra vieja; hoy esa pantalla es fondo claro, un panel negro
// de «Recaudado hoy» con la tira de siete días y la pastilla con el botón
// flotante. No sobrevivía ni un elemento — quien seguía el tutorial buscaba
// cosas que ya no existen.
//
// El bot ya lo tenía reconocido por escrito: «NUNCA ofrezcas ni envíes vídeos…
// los tutoriales que existen muestran una interfaz vieja». A los interesados se
// los escondíamos; a los que pagan se los seguíamos enseñando.
//
// Por eso esto es un GUION y no un trabajo manual: se vuelve a correr en cada
// rediseño y las capturas dejan de envejecer solas.
//
// ── ⚠ DE DÓNDE SALEN LOS DATOS, Y POR QUÉ IMPORTA TANTO ────────────────────
//
// De un negocio de MENTIRA («Créditos La Esperanza»), sembrado con
// `.auditoria/sembrar-vitrina.mjs`. NUNCA del espejo tal cual: su base es una
// copia con forma real —8.415 préstamos— y estas imágenes se sirven a los 429
// negocios. Publicar 18 capturas con nombres, cédulas y deudas de clientes
// reales sería mucho peor que las capturas viejas que venimos a arreglar.
//
// El guion COMPRUEBA que la sesión es la de la vitrina antes de disparar, y
// aborta si no lo es. No es paranoia: el paso donde se cuela un dato real es
// justo este.
//
// ── USO ─────────────────────────────────────────────────────────────────────
//
//   1. túnel:   ssh -N -L 3007:localhost:3005 root@69.62.87.141
//   2. siembra: (en el VPS) node _vitrina.mjs
//   3. aquí:    node scripts/capturar-tutoriales.mjs
//
// Escribe directamente en `public/tutoriales/`. Revisar antes de commitear.

import { chromium } from 'playwright'
import { encode } from 'next-auth/jwt'
import { writeFileSync, existsSync } from 'node:fs'
import { senalar, borrarSenales } from './senalar.mjs'
import { PASOS } from './pasos-tutoriales.mjs'

const BASE = process.env.BASE_CAPTURAS || 'http://localhost:3007'
const SECRETO = process.env.SECRETO_ESPEJO || 'prueba-rediseno-2026-no-usar-en-produccion-8f3a1c'
const ORG = 'vitrina_org_tutoriales'
const DUENO = 'vitrina_user_tutoriales'

/* 500×717 es EL TAMAÑO DE LAS VIEJAS, medido con `file` sobre los PNG. Se
   conserva a propósito: la pantalla de tutoriales y los correos ya están
   maquetados para esa proporción, y cambiarla obligaría a revisar los dos. */
const ANCHO = 500
const ALTO = 717

const token = await encode({
  token: {
    id: DUENO, email: 'vitrina@ejemplo.test', nombre: 'Carlos Ramírez',
    rol: 'owner', organizationId: ORG, plan: 'professional', country: 'co',
  },
  secret: SECRETO,
})

/* ══ DOS VITRINAS, NO UNA ═════════════════════════════════════════════════
 *
 * La llena («Créditos La Esperanza») sirve para casi todo. Pero varias guías
 * enseñan la pantalla de PRIMERA VEZ —«Registrar capital inicial», la ruta que
 * todavía no existe— y ese estado no puede convivir con un negocio que ya tiene
 * préstamos: en cuanto hay un desembolso, el capital deja de estar sin
 * configurar y el botón desaparece.
 *
 * Así que hay una segunda, «Mi Negocio Nuevo», SIN NADA dentro. Un paso pide
 * la que necesita con `vitrina: 'vacia'`.
 *
 * ⚠ SU COMPROBACIÓN VA AL REVÉS. A la llena se le exige que sus clientes estén
 * en la lista blanca; a la vacía se le exige estar VACÍA. Si algún día tuviera
 * clientes, o la sesión apunta a otro sitio o alguien la usó para trabajar, y
 * en los dos casos fotografiarla publicaría datos de alguien. */
const ORG_VACIA = 'vitrina_org_vacia'
const DUENO_VACIO = 'vitrina_user_vacio'

const nav = await chromium.launch()
const abrirVitrina = async (jwt) => {
  const c = await nav.newContext({
    viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true,
    storageState: { cookies: [{ name: 'next-auth.session-token', value: jwt, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] },
  })
  return c.newPage()
}
const p = await abrirVitrina(token)

/* La de cero se abre solo si alguna guía la pide: montarla siempre sería un
   navegador más por nada en la mayoría de las tiradas. */
let pVacia = null
const vitrinaVacia = async () => {
  if (pVacia) return pVacia
  const jwt = await encode({
    token: {
      id: DUENO_VACIO, email: 'vitrina.nueva@ejemplo.test', nombre: 'Carlos Ramírez',
      rol: 'owner', organizationId: ORG_VACIA, plan: 'professional', country: 'co',
    },
    secret: SECRETO,
  })
  pVacia = await abrirVitrina(jwt)
  /* Hay que ATERRIZAR antes de preguntar: un `fetch('/api/…')` desde
     `about:blank` no tiene origen contra el que resolver la ruta. */
  await pVacia.goto(`${BASE}/dashboard`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await pVacia.waitForTimeout(4000)
  const cuantos = await pVacia.evaluate(async () => {
    const r = await fetch('/api/clientes?limit=5')
    const j = await r.json()
    return (Array.isArray(j) ? j : (j.clientes ?? [])).length
  }).catch(() => null)
  if (cuantos === null) throw new Error('la vitrina de cero no responde: ¿existe la organización?')
  if (cuantos > 0) throw new Error(`la vitrina de cero tiene ${cuantos} clientes: no está vacía, no se fotografía`)
  return pVacia
}

/* Los avisos de bienvenida tapan la pantalla y saldrían en todas las fotos. */
const despejar = async (pg = p) => {
  for (let i = 0; i < 4; i++) {
    await pg.evaluate(() => {
      for (const t of ['Entendido', 'Ahora no', 'Cerrar', 'Después']) {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
        if (b) { b.click(); return }
      }
    })
    await pg.waitForTimeout(350)
  }
}

/* ── ⚠ LOS AVISOS DE ESTA SEMANA NO VAN EN UN TUTORIAL ─────────────────────
 * La primera corrida salió con la franja «Falta verificar tu correo» y con el
 * banner de la campaña de fotos —que se apaga el lunes— en TODAS las pantallas.
 * Un tutorial con el aviso de una campaña de tres días nace viejo otra vez, que
 * es justo lo que este guion viene a arreglar.
 *
 * Lo de verificar el correo se arregla en la cuenta (la vitrina va con
 * `emailVerificado = 1`). El banner de campaña no: es real mientras dure, así
 * que se quita del DOM antes de disparar y queda dicho aquí que se quita.
 * No se toca nada más — la captura tiene que enseñar la pantalla de verdad. */
const TEMPORALES = [
  'aprenda a leer tu cuaderno',   // campaña de fotos, hasta el 10 ago
  'Falta verificar tu correo',
  'nos mandaste',                 // el «gracias» de la misma campaña
]

/* ⚠⚠ ESTA FUNCIÓN ME VACIÓ EL PANEL ENTERO, Y LA SUBÍ ASÍ.
 *
 * Mi primera versión cogía el PRIMER `div` cuyo texto contuviera la frase, con
 * un `children.length < 8` de guardia. Eso no protege de nada: el recorrido del
 * DOM va de fuera adentro, así que el primero que coincide es un ANCESTRO —el
 * contenedor de toda la columna— y `.remove()` se llevó el panel completo. La
 * captura salió con la cabecera, la barra de abajo y NADA en medio.
 *
 * No lo cazó ninguna comprobación: el archivo existía, pesaba lo suyo y el
 * guion dijo «26 de 26 capturadas». Lo vi abriendo la imagen.
 *
 * Ahora hace dos cosas distintas:
 *   1. Busca el elemento MÁS PROFUNDO que contiene la frase y sube solo
 *      mientras el padre no traiga mucho más texto que él. Así se lleva la
 *      tarjeta del aviso y no la pantalla.
 *   2. Compara el texto de la página antes y después. Si se perdió más de un
 *      tercio, eso no fue una limpieza: fue un destrozo, y ABORTA.
 */
const quitarTemporales = async (pg = p) => {
  const perdida = await pg.evaluate((frases) => {
    const antes = document.body.innerText.length
    for (const f of frases) {
      const conLaFrase = [...document.querySelectorAll('div, p, span, button, a')]
        .filter((el) => (el.innerText || '').includes(f))
      if (!conLaFrase.length) continue
      // El más profundo = el de menos texto propio.
      let obj = conLaFrase.reduce((a, b) => ((a.innerText || '').length <= (b.innerText || '').length ? a : b))
      /* Sube hasta la TARJETA del aviso, y ni un paso más.
         ⚠ La regla de «el padre no puede traer 1,8× más texto» no sirvió: se
         paró en el `<p>` del titular y dejó media tarjeta con su botón, que es
         peor que dejarla entera. Lo que separa un aviso de una pantalla no es
         la proporción, es el TAMAÑO ABSOLUTO: un banner son doscientos y pico
         caracteres; el panel, miles. */
      const TOPE_AVISO = 500
      while (obj.parentElement && obj.parentElement !== document.body
             && (obj.parentElement.innerText || '').length <= TOPE_AVISO) {
        obj = obj.parentElement
      }
      obj.remove()
    }
    return 1 - document.body.innerText.length / (antes || 1)
  }, TEMPORALES)
  if (perdida > 0.33) {
    throw new Error(`quitarTemporales se llevó el ${Math.round(perdida * 100)}% del texto de la pantalla`)
  }
}

const ir = async (ruta, espera = 6500, pg = p) => {
  await pg.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await pg.waitForTimeout(espera)
  await despejar(pg)
  await quitarTemporales(pg)
  await pg.waitForTimeout(400)
}

// ── ⚠ LA GUARDIA. Antes de disparar nada. ──────────────────────────────────
await ir('/dashboard', 12000)
const dueno = await p.evaluate(async () => {
  const r = await fetch('/api/clientes?limit=60')
  const j = await r.json()
  const l = Array.isArray(j) ? j : (j.clientes ?? [])
  return { cuantos: l.length, nombres: l.map((c) => c.nombre).slice(0, 40) }
})
const ESPERADOS = ['Steven Olmos', 'Carlitos Chaparro', 'María Fernanda Restrepo', 'Jhoan Sebastián Cruz',
  'Marta Lucía Ríos', 'Julián Vélez', 'Ana Milena Guzmán', 'Diego Alejandro Peña']
const intrusos = dueno.nombres.filter((n) => !ESPERADOS.includes(n))
if (intrusos.length) {
  console.error('ABORTADO: la sesión ve clientes que NO son de la vitrina.')
  console.error('  ' + intrusos.slice(0, 6).join(' · '))
  console.error('  Fotografiar esto publicaría datos de gente real.')
  await nav.close(); process.exit(1)
}
if (!dueno.cuantos) {
  console.error('ABORTADO: la vitrina está vacía. Siembra primero (`node _vitrina.mjs` en el VPS).')
  await nav.close(); process.exit(1)
}
console.log(`vitrina comprobada: ${dueno.cuantos} clientes, ninguno real\n`)

// ── Los ids que hacen falta para las pantallas de detalle ─────────────────
const uno = await p.evaluate(async () => {
  const j = async (u) => { const r = await fetch(u); return r.json() }
  const pri = (x, k) => (Array.isArray(x) ? x : (x?.[k] ?? []))[0]?.id
  const [cl, pr, ru, co] = await Promise.all([
    j('/api/clientes?limit=1'), j('/api/prestamos?limit=1'), j('/api/rutas'), j('/api/cobradores'),
  ])
  return {
    cliente: pri(cl, 'clientes'), prestamo: pri(pr, 'prestamos'),
    ruta: pri(ru, 'rutas'), cobrador: pri(co, 'cobradores'),
  }
})

const direccionDe = (paso) => {
  if (paso.en === 'prestamo') return `/prestamos/${uno.prestamo}`
  if (paso.en === 'cliente') return `/clientes/${uno.cliente}`
  if (paso.en === 'ruta') return `/rutas/${uno.ruta}`
  if (paso.en === 'cobrador') return `/cobradores/${uno.cobrador}`
  return paso.en
}

/* ⚠ «EMPIEZA POR», no igualdad. Los botones de esta app llevan la cifra
   pegada —«Empezar recorrido · 4», «Gestionar los pagos (5)»— y una
   comparación exacta falla el día que cambia el número, sin decir por qué. */
const tocar = async (rotulo, pg = p) => {
  const dio = await pg.evaluate((r) => {
    const limpio = (s) => (s || '').replace(/\s+/g, ' ').trim()
    /* ⚠ Y SOLO LO QUE SE VE: el mismo botón está pintado dos veces —móvil y
       escritorio— y el oculto va primero en el DOM. Pulsarlo no hace nada y la
       captura sale de la pantalla anterior, sin error. */
    const seVe = (el) => {
      const b = el.getBoundingClientRect()
      return b.width > 0 && b.height > 0 && getComputedStyle(el).visibility !== 'hidden'
    }
    const cand = [...document.querySelectorAll('button, a, [role="button"]')]
      .filter((x) => limpio(x.textContent).startsWith(r) && seVe(x))
    if (!cand.length) return false
    // El de texto más corto: el recorrido del DOM va de fuera adentro y el
    // primero que coincide suele ser un contenedor.
    const b = cand.reduce((a, c) => (limpio(a.textContent).length <= limpio(c.textContent).length ? a : c))
    b.click()
    return true
  }, rotulo)
  if (!dio) throw new Error(`no encontré «${rotulo}»`)
  await pg.waitForTimeout(1700)
}

const SOLO = process.env.SOLO || ''
const LISTA = SOLO ? PASOS.filter((g) => SOLO.split(',').map((x) => x.trim()).includes(g.id)) : PASOS

const manifiesto = []
let hechas = 0
const fallos = []

for (const guia of LISTA) {
  const imagenes = []
  for (let i = 0; i < guia.pasos.length; i++) {
    const paso = guia.pasos[i]
    const archivo = `${guia.id}-${i + 1}.png`
    try {
      if (paso.sinSesion) {
        /* Contexto aparte, no `clearCookies`: el resto de capturas necesitan
           la sesión intacta. */
        const limpio = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true })
        const q = await limpio.newPage()
        await q.goto(`${BASE}${paso.en}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
        await q.waitForTimeout(4500)
        if (paso.senal) await senalar(q, { ...paso.senal, numero: i + 1 })
        await q.screenshot({ path: `public/tutoriales/${archivo}` })
        await limpio.close()
      } else {
        /* ⚠ LA VITRINA QUE PIDA EL PASO. Casi todos van con la llena; los que
           enseñan una pantalla de PRIMERA VEZ —capital sin configurar, la ruta
           que aún no existe— piden la de cero, porque ese estado no puede
           convivir con un negocio que ya tiene préstamos. */
        const pg = paso.vitrina === 'vacia' ? await vitrinaVacia() : p
        await ir(direccionDe(paso), 6500, pg)
        for (const t of (paso.toques ?? [])) { await tocar(t, pg); await quitarTemporales(pg) }
        if (paso.senal) await senalar(pg, { ...paso.senal, numero: i + 1 })
        await pg.screenshot({ path: `public/tutoriales/${archivo}` })
        if (paso.senal) await borrarSenales(pg)

        /* Que el archivo exista no basta: una pantalla de error también se
           fotografía tan ricamente. */
        const texto = await pg.evaluate(() => document.body.innerText.slice(0, 220))
        const m = texto.match(/(no se encontr\w*|no encontrad\w*|algo salió mal|Error al \w+)/i)
        if (m) throw new Error(`la pantalla dice «${m[0]}»`)
      }
      imagenes.push({ src: `/tutoriales/${archivo}`, caption: paso.pie })
      console.log(`· ${archivo.padEnd(30)} ${paso.pie.slice(0, 46)}`)
      hechas++
    } catch (e) {
      /* ⚠ EL PASO QUE FALLA NO SE CUELA MUDO. Si el señalamiento no encuentra
         su botón y dejáramos pasar la foto, quedaría una captura sin la flecha
         —que es justo lo que el dueño reclamó— y nadie se enteraría: el archivo
         existe y pesa lo suyo. Se cae fuera del manifiesto y se avisa. */
      console.log(`✗ ${archivo.padEnd(30)} ${e.message.slice(0, 70)}`)
      fallos.push(`${archivo}: ${e.message.slice(0, 70)}`)
    }
  }
  if (imagenes.length) manifiesto.push({ id: guia.id, imagenes })
}

/* ── EL MANIFIESTO, GENERADO ────────────────────────────────────────────────
   `lib/tutoriales/pasos.js` NO se escribe a mano. Si las capturas y la lista
   de imágenes de cada guía se mantuvieran por separado, el día que un paso
   falle la guía seguiría prometiendo una imagen que no existe — y el `<Image>`
   de Next da error de «imagen inválida», no un hueco. */
if (!SOLO) {
  const cuerpo = manifiesto.map((g) => `  '${g.id}': [\n`
    + g.imagenes.map((im) => `    { src: '${im.src}', caption: ${JSON.stringify(im.caption)} },`).join('\n')
    + '\n  ],').join('\n')
  writeFileSync('lib/tutoriales/pasos.js',
    '// lib/tutoriales/pasos.js — GENERADO. No editar a mano.\n'
    + '//\n'
    + '// Lo escribe `scripts/capturar-tutoriales.mjs` con las capturas que de\n'
    + '// verdad salieron. Un paso que falló no aparece aquí: así la guía nunca\n'
    + '// pide una imagen que no existe.\n'
    + '//\n'
    + '// Para rehacerlas: túnel al espejo, sembrar la vitrina y correr el guion.\n'
    + '\nexport const PASOS_GUIA = {\n' + cuerpo + '\n}\n', 'utf8')
  console.log('\n→ lib/tutoriales/pasos.js')
}

console.log(`\n${hechas} capturas en ${manifiesto.length} guías`)
if (fallos.length) {
  console.log(`\n⚠ ${fallos.length} pasos sin captura:`)
  for (const f of fallos) console.log('  ' + f)
}
await nav.close()
