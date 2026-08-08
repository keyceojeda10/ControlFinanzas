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

const nav = await chromium.launch()
const ctx = await nav.newContext({
  viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true,
  storageState: { cookies: [{ name: 'next-auth.session-token', value: token, domain: 'localhost', path: '/', httpOnly: true, secure: false, sameSite: 'Lax' }], origins: [] },
})
const p = await ctx.newPage()

/* Los avisos de bienvenida tapan la pantalla y saldrían en todas las fotos. */
const despejar = async () => {
  for (let i = 0; i < 4; i++) {
    await p.evaluate(() => {
      for (const t of ['Entendido', 'Ahora no', 'Cerrar', 'Después']) {
        const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === t)
        if (b) { b.click(); return }
      }
    })
    await p.waitForTimeout(350)
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
const quitarTemporales = () => p.evaluate((frases) => {
  for (const f of frases) {
    for (const el of document.querySelectorAll('div, button, a')) {
      if (el.children.length < 8 && (el.innerText || '').includes(f)) { el.remove(); break }
    }
  }
}, TEMPORALES)

const ir = async (ruta, espera = 6500) => {
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
  await p.waitForTimeout(espera)
  await despejar()
  await quitarTemporales()
  await p.waitForTimeout(400)
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

// ── Las 18, con la ruta de cada una ────────────────────────────────────────
const uno = await p.evaluate(async () => {
  const [cl, pr, ru] = await Promise.all([
    fetch('/api/clientes?limit=1').then((r) => r.json()),
    fetch('/api/prestamos?limit=1').then((r) => r.json()),
    fetch('/api/rutas').then((r) => r.json()),
  ])
  const pri = (x, k) => (Array.isArray(x) ? x : (x?.[k] ?? []))[0]?.id
  return { cliente: pri(cl, 'clientes'), prestamo: pri(pr, 'prestamos'), ruta: pri(ru, 'rutas') }
})

const PANTALLAS = [
  { archivo: '01_login.png', ruta: '/login', sinSesion: true },
  { archivo: '02_dashboard.png', ruta: '/dashboard' },
  { archivo: '03_clientes_lista.png', ruta: '/clientes' },
  { archivo: '04_cliente_nuevo.png', ruta: '/clientes/nuevo' },
  { archivo: '05_cliente_detalle.png', ruta: `/clientes/${uno.cliente}` },
  { archivo: '06_prestamos_lista.png', ruta: '/prestamos' },
  { archivo: '07_prestamo_nuevo.png', ruta: '/prestamos/nuevo' },
  { archivo: '08_prestamo_pago.png', ruta: `/prestamos/${uno.prestamo}` },
  { archivo: '09_rutas_lista.png', ruta: '/rutas' },
  { archivo: '10_ruta_detalle.png', ruta: `/rutas/${uno.ruta}` },
  { archivo: '11_cobradores_lista.png', ruta: '/cobradores' },
  { archivo: '12_cobrador_nuevo.png', ruta: '/cobradores?nuevo=1' },
  { archivo: '13_caja.png', ruta: '/caja' },
  { archivo: '14_reportes.png', ruta: '/reportes' },
  { archivo: '15_plan.png', ruta: '/configuracion/plan' },
  { archivo: '16_configuracion.png', ruta: '/configuracion' },
  { archivo: '17_soporte_lista.png', ruta: '/soporte' },
  { archivo: '18_soporte_nuevo.png', ruta: '/soporte/nuevo' },

  /* ── Las que faltaban ────────────────────────────────────────────────────
     Ocho tutoriales no tenían NI UNA imagen: abono a capital, recargos, caja
     por cuentas, capital, socios, el portal del cliente, el recorrido de cobro
     y «Más». Se explicaban solo con texto, y el texto era de marzo.

     Varias no son una dirección: hay que ABRIR una hoja. Por eso llevan
     `toca`, con el rótulo exacto que salió de `rotulos.json` — escribirlo de
     memoria es como se acaba fotografiando una pantalla que no es. */
  { archivo: '19_cobros_hoy.png', ruta: '/cobros-hoy' },
  { archivo: '20_mas.png', ruta: '/mas' },
  { archivo: '21_capital.png', ruta: '/capital' },
  { archivo: '22_socios.png', ruta: '/socios' },
  { archivo: '23_caja_cuentas.png', ruta: '/caja', toca: 'Cuentas' },
  { archivo: '24_prestamo_gestion.png', ruta: null, deDetallePrestamo: true, toca: 'Gestión' },
  { archivo: '25_prestamo_abonos.png', ruta: null, deDetallePrestamo: true, toca: 'Abonos' },
  { archivo: '26_cliente_portal.png', ruta: null, deDetalleCliente: true, toca: 'Activar portal' },
]

let hechas = 0, fallos = []
for (const s of PANTALLAS) {
  try {
    if (s.sinSesion) {
      /* El login se fotografía SIN sesión o redirige al panel. Contexto aparte,
         no `clearCookies`: el resto de capturas necesitan la sesión intacta. */
      const limpio = await nav.newContext({ viewport: { width: ANCHO, height: ALTO }, deviceScaleFactor: 2, isMobile: true })
      const q = await limpio.newPage()
      await q.goto(`${BASE}${s.ruta}`, { waitUntil: 'domcontentloaded', timeout: 90000 })
      await q.waitForTimeout(4000)
      await q.screenshot({ path: `public/tutoriales/${s.archivo}` })
      await limpio.close()
    } else {
      const destino = s.deDetallePrestamo ? `/prestamos/${uno.prestamo}`
        : s.deDetalleCliente ? `/clientes/${uno.cliente}` : s.ruta
      await ir(destino)
      if (s.toca) {
        const abrio = await p.evaluate((rotulo) => {
          const b = [...document.querySelectorAll('button, a')]
            .find((x) => (x.textContent || '').replace(/\s+/g, ' ').trim() === rotulo)
          if (!b) return false
          b.click(); return true
        }, s.toca)
        if (!abrio) throw new Error(`no encontré «${s.toca}»`)
        await p.waitForTimeout(1600)
        await quitarTemporales()
      }
      await p.screenshot({ path: `public/tutoriales/${s.archivo}` })
    }
    /* Que el archivo exista no basta: una pantalla de error también se
       fotografía tan ricamente.

       ⚠ Y EL AVISO DICE QUÉ ENCONTRÓ. Mi primera versión solo decía «LA
       PANTALLA DA ERROR» y señaló el ticket de soporte, que estaba perfecto:
       sin ver el fragmento no hay forma de saber si el fallo es de la pantalla
       o del detector. Un medidor que acusa sin citar hace perder más tiempo del
       que ahorra. */
    const texto = s.sinSesion ? '' : await p.evaluate(() => document.body.innerText.slice(0, 200))
    const m = texto.match(/(no se encontr\w*|no encontrad\w*|algo salió mal|Error al \w+)/i)
    console.log(`${m ? '⚠' : '·'} ${s.archivo.padEnd(24)} ${s.ruta}${m ? `  ← dice «${m[0]}»` : ''}`)
    if (m) fallos.push(s.archivo)
    hechas++
  } catch (e) {
    console.log(`✗ ${s.archivo.padEnd(24)} ${e.message.slice(0, 60)}`)
    fallos.push(s.archivo)
  }
}

console.log(`\n${hechas} de ${PANTALLAS.length} capturadas`)
if (fallos.length) console.log('revisar a mano: ' + fallos.join(', '))
await nav.close()
