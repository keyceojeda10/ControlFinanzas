// scripts/video-demo/v00-como-llegar.mjs
//
// LAS ESCENAS QUE FALTABAN: CÓMO SE LLEGA A CADA PANTALLA
//
//     node scripts/video-demo/v00-como-llegar.mjs
//     node scripts/video-demo/v00-como-llegar.mjs --toma 3
//
// ── QUÉ PASÓ ───────────────────────────────────────────────────────────────
//
// El dueño, después de editar la mitad de los vídeos:
//
//   «Dice "vamos a crear las rutas", pero no dice cómo llega al apartado de
//    crear ruta. Llega ahí a la pantalla y empieza a explicar. La explicación
//    está correcta, pero ¿cómo sabe la gente llegar a esa pantalla?»
//
// Y la causa está en el propio grabador, en una línea que parecía un detalle:
//
//     await hastaRutas(u)     // el camino: panel → pestaña de rutas
//     empezar()               // ⚠ el reloj de la toma arranca AQUÍ
//
// `empezar()` marca dónde empieza lo que se graba. Todo lo de antes se ejecuta
// —el navegador va pulsando— pero queda FUERA del vídeo. Así que en once de los
// trece vídeos el camino existe, se recorre y no se ve. El tutorial abre ya
// dentro de la pantalla, como si el espectador hubiera llegado solo.
//
// ── POR QUÉ ESTO Y NO REHACER LOS VÍDEOS ───────────────────────────────────
//
// Están montados y con la voz puesta. Rehacerlos sería tirar ese trabajo para
// arreglar diez segundos del principio. Cada toma vive en su propio `.mp4`
// (`tomas-07/00-que_es.mp4`, …) y el vídeo final es la suma en orden, así que
// una escena nueva por delante se añade en el montaje sin tocar nada más.
//
// Estas escenas están hechas para EMPALMAR: cada una acaba quieta sobre la
// misma pantalla en la que abre el vídeo al que precede.
//
// ── LOS QUE NO ESTÁN, Y POR QUÉ ────────────────────────────────────────────
//
//  · 01-registro    — se llega por la web, no por el menú.
//  · 02-cliente     — ya abre en el panel y señala el botón. Está bien.
//  · 03 y 04        — son la guía de primeros pasos, que sale sola al entrar.
//  · 09-cobrar      — ya navega en cámara (panel → rutas → salir a cobrar).
//  · 13-corto       — es el anuncio, no un tutorial.
//
// ⚠ NECESITA EL ESPEJO EN PIE, como todos los demás:
//     ssh -N -L 3341:127.0.0.1:3306 root@69.62.87.141
//     bash .auditoria/arrancar-espejo.sh

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS.
   Reportado por el dueño viendo el vídeo 15: «no está señalando bien el icono;
   señala un texto y no el icono de los préstamos en el menú».
   En el panel hay DOS enlaces visibles a `/prestamos`: el «Ver todos →» de una
   tarjeta (y=1874) y el icono de la barra (y=890). `.first()` coge el de la
   tarjeta porque va antes en el DOM, y `:visible` no ayuda: los dos lo están.
   Hoy solo pasa con préstamos, pero cualquier «Ver todos» que se añada mañana
   rompe el de al lado, así que se acota a la barra en todos. */
const MENU = 'nav[aria-label="Navegación principal"]'

const CLIENTE = 'Fabián Quintero'
const MONTO = '400000'

/* El arranque de TODAS: el panel, quieto un momento antes de tocar nada.
   Sin esa quietud la escena abre con el dedo ya pulsando y no se ve de dónde
   sale. */
const enElPanel = async ({ ir, esperar, empezar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1400)
  empezar()
  await esperar(1600)
}

/* La barra de abajo y el botón de «Más» son los dos caminos del sistema, y son
   lo que hay que enseñar. Se señalan antes de pulsarlos: el acercamiento es lo
   que convierte «toqué algo» en «toqué ESE». */
const porLaBarra = async (u, { href, dice, rotulo }) => {
  await u.decir(dice, 4.2)
  await u.esperar(1200)
  await u.mirar(`a[href="${href}"]:visible`, { escala: 2.4, ms: 3400 })
  await u.esperar(2600)
  await u.tocarSel(`a[href="${href}"]:visible`)
  await u.esperar(3000)
  if (rotulo) { await u.decir(rotulo, 4.0); await u.esperar(4200) }
}

const TOMAS = [
  // ── 05 · PRÉSTAMO ────────────────────────────────────────────────────────
  {
    id: 'v05-prestamo',
    titulo: 'Cómo llegar · crear un préstamo',
    async grabar(u) {
      const { esperar, decir, mirar, tocar, reposo } = u
      await enElPanel(u)
      await decir('Para prestarle a alguien, el botón del más, abajo a la derecha', 5.0)
      await esperar(1400)
      await mirar('button[aria-label="Crear"]', { escala: 2.4, ms: 3600 })
      await esperar(2400)
      await tocar('Crear')
      await esperar(2600)
      await decir('Se abre el menú de todo lo que puedes hacer', 4.0)
      await esperar(4200)
      await mirar('text=Prestarle a alguien', { escala: 1.8, ms: 4000 })
      await esperar(2600)
      await decir('En «sale plata»: «Prestarle a alguien»', 4.0)
      await esperar(4200)
      await tocar('Prestarle a alguien')
      await reposo(3400)
    },
  },

  // ── 06 · MODOS DE INTERÉS ────────────────────────────────────────────────
  {
    id: 'v06-modos',
    titulo: 'Cómo llegar · el modo de interés',
    async grabar(u) {
      const { esperar, decir, mirar, tocar, escribir, reposo, p } = u
      await enElPanel(u)
      await decir('El modo de interés no es una pantalla aparte', 4.2)
      await esperar(1200)
      await mirar('button[aria-label="Crear"]', { escala: 2.4, ms: 3200 })
      await esperar(2200)
      await tocar('Crear')
      await esperar(1600)
      await tocar('Prestarle a alguien')
      /* ⚠ AQUÍ SE BUSCA AL CLIENTE, NO SE PULSA EN «RECIENTES».
         Primero lo pulsaba, como hace `v06-modos-interes`, y la toma reventaba:
         «Timeout esperando a Fabián Quintero». No era el reloj —esperar más no
         lo arreglaba—: es que RECIENTES solo enseña tres, y desde que se grabó
         el vídeo 6 los tres son otros. Lo vi en la captura de la pantalla, no
         en el código.

         ⚠ Y esto quiere decir que `v06-modos-interes.mjs` tampoco se puede
         volver a grabar hoy tal cual. Buscar por el nombre no depende de qué
         estuvo reciente, así que además de arreglar esta toma es lo que hay que
         llevarse a los otros guiones. */
      await p.waitForSelector('text=Elige el cliente', { timeout: 25000 }).catch(() => {})
      await esperar(1600)
      await decir('Está dentro del préstamo que estás haciendo', 4.2)
      await escribir('input[placeholder*="Buscar por nombre"]', 'Fabi')
      await esperar(2600)
      await tocar(CLIENTE)
      await esperar(1200)
      await tocar('Continuar')
      await esperar(1600)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await esperar(1800)
      await decir('Pones el monto y sigues bajando', 3.8)
      await esperar(2000)
      await p.locator('button:has-text("¿No sabes cuál usar?")').first()
        .scrollIntoViewIfNeeded().catch(() => {})
      await esperar(2000)
      await mirar('label:has-text("Modo de interés")', { escala: 1.6, ms: 4000 })
      await esperar(2600)
      await decir('Ahí lo tienes: «modo de interés»', 3.8)
      await esperar(4000)
      await reposo(3000)
    },
  },

  // ── 07 · RUTAS ───────────────────────────────────────────────────────────
  {
    id: 'v07-rutas',
    titulo: 'Cómo llegar · las rutas',
    async grabar(u) {
      await enElPanel(u)
      await porLaBarra(u, {
        href: '/rutas',
        dice: 'Las rutas están en la barra de abajo, en el mapita',
        rotulo: 'Y aquí las tienes todas',
      })
      await u.reposo(3200)
    },
  },

  // ── 08 · COBRADORES ──────────────────────────────────────────────────────
  {
    id: 'v08-cobradores',
    titulo: 'Cómo llegar · los cobradores',
    async grabar(u) {
      const { esperar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      await decir('Los cobradores están en «más», el último de la barra', 4.6)
      await esperar(1200)
      await mirar(`${MENU} a[href="/mas"]`, { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocarSel(`${MENU} a[href="/mas"]`)
      await esperar(2800)
      await decir('Aquí dentro está todo lo que no cabe abajo', 4.2)
      await esperar(2200)
      await mirar('button:has-text("Cobradores"):visible, a:has-text("Cobradores"):visible',
        { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await tocarSel('button:has-text("Cobradores"):visible, a:has-text("Cobradores"):visible')
      await esperar(3200)
      await decir('Y esta es tu gente', 3.6)
      await esperar(3800)
      await reposo(3200)
    },
  },

  // ── 10 · AJUSTES ─────────────────────────────────────────────────────────
  {
    id: 'v10-ajustes',
    titulo: 'Cómo llegar · los ajustes',
    async grabar(u) {
      const { esperar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      await decir('Los ajustes también están en «más»', 4.0)
      await esperar(1200)
      await mirar(`${MENU} a[href="/mas"]`, { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocarSel(`${MENU} a[href="/mas"]`)
      await esperar(2800)
      await mirar('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible',
        { escala: 1.8, ms: 3800 })
      await esperar(2200)
      await decir('Abajo del todo: «configuración»', 3.8)
      await esperar(3000)
      await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
      await esperar(3400)
      await reposo(3200)
    },
  },

  // ── 11 · CAJA ────────────────────────────────────────────────────────────
  {
    id: 'v11-caja',
    titulo: 'Cómo llegar · la caja',
    /* ⚠ ESTA VA CON LA SESIÓN DEL COBRADOR, no con la del dueño.
       El vídeo 11 abre en la caja del cobrador —«es la que manda»— y esa
       pestaña solo existe en SU barra: con la sesión del dueño no hay
       `a[href="/caja"]` que valga y la toma se queda esperando a un botón que
       nunca aparece. La caja del dueño vive en «Más», que es otro camino. */
    rol: 'cobrador',
    async grabar(u) {
      await enElPanel(u)
      await porLaBarra(u, {
        href: '/caja',
        dice: 'La caja está en la barra de abajo, en el billete',
        rotulo: 'Esta es la del cobrador, la que se cuadra cada noche',
      })
      await u.reposo(3200)
    },
  },

  // ── 12 · CAPITAL ─────────────────────────────────────────────────────────
  {
    id: 'v12-capital',
    titulo: 'Cómo llegar · tu capital',
    async grabar(u) {
      const { esperar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      await decir('Tu capital está en «más»', 3.6)
      await esperar(1200)
      await mirar(`${MENU} a[href="/mas"]`, { escala: 2.4, ms: 3400 })
      await esperar(2400)
      await tocarSel(`${MENU} a[href="/mas"]`)
      await esperar(2800)
      await mirar('button:has-text("Mi plata"):visible, a:has-text("Mi plata"):visible',
        { escala: 1.8, ms: 3800 })
      await esperar(2200)
      await decir('Se llama «mi plata»', 3.4)
      await esperar(2800)
      await tocarSel('button:has-text("Mi plata"):visible, a:has-text("Mi plata"):visible')
      await esperar(4200)
      await decir('Y aquí está todo tu dinero, el que tienes y el que está fuera', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },
]

/* Las dos sesiones, con la misma forma que usa `v11-caja.mjs`. El cobrador
   necesita `rutaIds`: sin eso el sistema le cierra sus propias pantallas. */
const galleta = (rol) => encode({
  token: {
    sub: rol === 'owner' ? IDS.owner : IDS.cobrador,
    id: rol === 'owner' ? IDS.owner : IDS.cobrador,
    email: 'demo@ejemplo.com',
    name: rol === 'owner' ? 'Sofía Restrepo' : 'Andrés Vargas',
    rol, organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: rol === 'owner' ? [] : [IDS.ruta],
  },
  secret: SECRETO,
})

const cookie = await galleta('owner')
const cookieCobrador = await galleta('cobrador')
for (const t of TOMAS) if (t.rol === 'cobrador') t.cookie = cookieCobrador

await correr({
  nombre: 'cómo llegar',
  // Van a la carpeta de los vídeos, junto a las `tomas-XX`, porque es donde el
  // montador las va a buscar.
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-como-llegar',
  // El pegado es solo para revisarlas de una pasada. Lo que se usa al montar
  // son los `.mp4` sueltos de la carpeta de arriba, uno por vídeo.
  final: '/home/keyce/Desktop/videos-tutoriales/como-llegar-REVISION.mp4',
  tomas: TOMAS,
  cookie,
})
