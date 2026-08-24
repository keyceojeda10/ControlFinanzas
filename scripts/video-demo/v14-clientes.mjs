// scripts/video-demo/v14-clientes.mjs
//
// VÍDEO 14 · La pantalla de clientes, y la ficha de uno por dentro
//
//     node scripts/video-demo/v14-clientes.mjs
//     node scripts/video-demo/v14-clientes.mjs --toma 9
//
// Pedido del dueño: «que la gente sepa QUÉ PUEDE HACER en esa pantalla y dentro
// de la ficha de cada cliente. A grosso modo, no muy detallado. Por ejemplo,
// mucha gente pregunta cómo se borra un cliente.»
//
// Así que este vídeo NO enseña a hacer cada cosa: enseña DÓNDE ESTÁ CADA COSA.
// Es un mapa, no un manual. Quien quiera el detalle tiene su propio vídeo o la
// guía del buscador.
//
// ── LA TOMA QUE JUSTIFICA EL VÍDEO ─────────────────────────────────────────
//
// La 10, «no me deja borrarlo». Es la pregunta que más llega a soporte, y la
// respuesta está en la propia pantalla: un cliente con préstamo activo NO se
// borra —lo bloquea el API, no la pantalla (`app/api/clientes/[id]/route.js`
// :394)— y lo que sale es un modal con las dos salidas: borrar ese préstamo, o
// pasárselo a otro cliente.
//
// ⚠ PULSAR «Eliminar» AHÍ ES SEGURO y por eso se graba de verdad: el cliente
//   de la demo tiene un préstamo activo, así que el borrado se rechaza. Nada se
//   pierde y se ve lo que el usuario ve.
//
// ── ⚠ LA PRIMERA TOMA ENSEÑA EL CAMINO ─────────────────────────────────────
//
// `empezar()` va ANTES de tocar la pestaña, no después. Es el fallo que costó
// las siete escenas de `v00-como-llegar.mjs`: en once de los trece vídeos el
// camino se recorría antes de `empezar()` y quedaba fuera de la grabación.
//
// ⚠ TODOS LOS SELECTORES LLEVAN `:visible`: esta pantalla pinta el árbol de
//   móvil y el de escritorio a la vez, y `.first()` coge el escondido.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const CLIENTE = 'Marta Elena Ospina'

/** El panel, quieto un momento. Todas las tomas salen de aquí. */
const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** La lista de clientes, por la pestaña, que es por donde se llega. */
const hastaClientes = async (u) => {
  await enElPanel(u)
  await u.tocarSel('a[href="/clientes"]:visible')
  await u.esperar(3000)
}

/** Y de ahí, dentro de la ficha de uno. */
const hastaLaFicha = async (u) => {
  await hastaClientes(u)
  await u.tocar(CLIENTE)
  await u.esperar(3600)
}

/** Baja hasta un trozo de la ficha sin que se vea el salto. */
const bajarHasta = async (u, sel) => {
  await u.p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(1400)
}

/* ══ EL RITMO LO PONE LA VOZ, NO EL RELOJ ═══════════════════════════════════
 *
 * El dueño, viendo la primera muestra con audio: «el vídeo tiene un ritmo
 * demasiado lento» y «que se puedan ver más interacciones, no solamente como un
 * clic en un botón y ya está».
 *
 * Medido en la toma 1 de la versión anterior: 18,1 segundos de imagen y 7,2 de
 * voz. Once de silencio. Y en el vídeo entero, 3:57 de imagen para 2:41 de
 * narración: **76 segundos mirando una pantalla quieta**.
 *
 * La causa no era descuido: las esperas se calcularon contra las palabras que
 * CABÍAN a 2,4 por segundo, y la narración se escribió con margen a propósito.
 * Dos decisiones razonables que juntas dejan el vídeo muerto.
 *
 * Ahora cada parada es `narrar(i)`: coge la frase i de la locución, lee cuánto
 * dura su audio YA GENERADO y espera exactamente eso. Y lo que la pantalla hace
 * —el acercamiento, el toque, el desplazamiento— ocurre DENTRO de la frase, no
 * después de callar.
 *
 * ⚠ Hay que generar el audio antes:
 *     node scripts/video-demo/voz.mjs 14-clientes --solo-audio
 *     SIN_ROTULOS=1 LOCUCION=14-clientes node scripts/video-demo/v14-clientes.mjs
 */
const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde están tus clientes',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0, {
        mirar: 'a[href="/clientes"]:visible', escala: 2.4,
        hacer: async () => { await tocarSel('a[href="/clientes"]:visible'); await esperar(1600) },
      })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'la_ficha_de_la_lista',
    titulo: 'Lo que dice cada uno sin abrirlo',
    async grabar(u) {
      const { empezar, narrar, mirar, esperar, reposo, p } = u
      await hastaClientes(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=Wilmer Andrés Salas', escala: 1.5, fila: true })
      // Se baja mientras habla: así se ve que la lista sigue, y no un cartel fijo.
      await narrar(2, {
        hacer: async () => {
          await p.mouse.wheel(0, 260); await esperar(500)
          await mirar('text=Nubia Castaño', { escala: 1.4, ms: 2600, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'buscador',
    titulo: 'Buscar a uno',
    async grabar(u) {
      const { empezar, narrar, escribir, esperar, reposo, p } = u
      const CAMPO = 'input[placeholder="Nombre o cédula"]:visible'
      await hastaClientes(u)
      empezar()
      await narrar(0, { mirar: CAMPO, escala: 1.8 })
      /* Se escribe DOS veces: primero un nombre, se borra y luego una cédula.
         Con una sola búsqueda no se ve que también acepta el número, que es la
         mitad de lo que dice la frase. */
      await narrar(1, {
        hacer: async () => {
          await escribir(CAMPO, 'Marta'); await esperar(1500)
          await p.locator(CAMPO).first().fill(''); await esperar(400)
          await escribir(CAMPO, '70933'); await esperar(1600)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'filtros',
    titulo: 'Los filtros',
    async grabar(u) {
      const { empezar, narrar, tocar, esperar, reposo } = u
      await hastaClientes(u)
      empezar()
      await narrar(0, { mirar: 'button:has-text("En mora"):visible', escala: 1.8 })
      // Dos filtros, no uno: se ve que la lista cambia de verdad al cambiarlos.
      await narrar(1, {
        hacer: async () => {
          await tocar('En mora'); await esperar(1600)
          await tocar('Al día'); await esperar(1600)
        },
      })
      await narrar(2, {
        hacer: async () => { await tocar('Todos'); await esperar(1200) },
      })
      await reposo(1400)
    },
  },

  {
    id: 'vistas',
    titulo: 'Cómo se ven',
    async grabar(u) {
      const { empezar, narrar, tocarSel, esperar, reposo } = u
      await hastaClientes(u)
      empezar()
      await narrar(0, { mirar: '[aria-label="Cuadrícula"]:visible', escala: 2.4 })
      await narrar(1, {
        hacer: async () => {
          await tocarSel('[aria-label="Cuadrícula"]:visible'); await esperar(2000)
        },
      })
      // Y se vuelve a fichas, para que se entienda que es un conmutador.
      await narrar(2, {
        hacer: async () => {
          await tocarSel('[aria-label="Fichas completas"]:visible'); await esperar(1400)
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'abrir',
    titulo: 'La ficha del cliente',
    async grabar(u) {
      const { empezar, narrar, tocar, esperar, reposo } = u
      await hastaClientes(u)
      empezar()
      await narrar(0, {
        hacer: async () => { await tocar(CLIENTE); await esperar(2600) },
      })
      await narrar(1, { mirar: 'text=SALDO TOTAL PENDIENTE', escala: 1.6, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'lucas',
    titulo: 'Lo que te sugiere Lucas',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=Lucas te sugiere')
      empezar()
      await narrar(0, { mirar: 'text=Lucas te sugiere', escala: 1.6 })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'prestamos',
    titulo: 'Sus préstamos',
    async grabar(u) {
      const { empezar, narrar, mirar, esperar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=PRÉSTAMOS ACTIVOS')
      empezar()
      await narrar(0, { mirar: 'text=PRÉSTAMOS ACTIVOS', escala: 1.6 })
      await narrar(1, {
        hacer: async () => {
          await mirar('text=Prestado el', { escala: 1.4, ms: 2600, fila: true })
        },
      })
      await narrar(2, { mirar: 'button:has-text("Nuevo préstamo"):visible', escala: 1.7 })
      await reposo(1400)
    },
  },

  {
    id: 'acciones',
    titulo: 'Todo lo que puedes hacerle',
    async grabar(u) {
      const { empezar, narrar, mirar, esperar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'button:has-text("Historial"):visible')
      empezar()
      await narrar(0, { mirar: 'button:has-text("Historial"):visible', escala: 1.5, fila: true })
      /* Se van señalando de tres en tres mientras se nombran. Antes era un solo
         acercamiento a toda la fila y el rótulo cantaba nueve cosas sobre una
         imagen quieta. */
      await narrar(1, {
        hacer: async () => {
          await mirar('button:has-text("Enviar por WhatsApp"):visible', { escala: 1.5, ms: 1900, fila: true })
          await esperar(300)
          await mirar('button:has-text("Actualizar ubicación"):visible', { escala: 1.5, ms: 1900, fila: true })
        },
      })
      await narrar(2, {
        hacer: async () => {
          await mirar('button:has-text("QR"):visible', { escala: 1.5, ms: 1800, fila: true })
          await esperar(300)
          await mirar('button:has-text("Inactivar"):visible', { escala: 1.5, ms: 1800, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'borrar',
    titulo: 'Cómo se borra un cliente',
    async grabar(u) {
      const { empezar, narrar, tocarSel, esperar, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'button:has-text("Eliminar"):visible')
      empezar()
      await narrar(0, { mirar: 'button:has-text("Eliminar"):visible', escala: 2.0 })
      await narrar(1, {
        hacer: async () => { await tocarSel('button:has-text("Eliminar"):visible'); await esperar(1800) },
      })
      /* ⚠ SE PULSA DE VERDAD, Y ES SEGURO: este cliente tiene un préstamo
         activo, así que el sistema RECHAZA el borrado. Es justo lo que hay que
         enseñar —el «no me deja»— y no se pierde nada.

         ⚠ Y EL BOTÓN ES EL DEL MODAL, no el de la página. `:visible` no basta:
         el de detrás también lo está, el selector lo cogía primero y Playwright
         se quedaba diez segundos diciendo que «el overlay intercepta el clic».
         Se ancla al `.fixed.inset-0`, que es la caja del modal. */
      await narrar(2, {
        hacer: async () => { await tocarSel('.fixed.inset-0 button:has-text("Eliminar")'); await esperar(2200) },
      })
      await narrar(3, {
        hacer: async () => {
          await mirar('.fixed.inset-0 button:has-text("Trasladar a otro cliente")', { escala: 1.5, ms: 2600, fila: true })
          await esperar(300)
          await mirar('.fixed.inset-0 button:has-text("Eliminar préstamo")', { escala: 1.5, ms: 2600, fila: true })
        },
      })
      await narrar(4)
      await reposo(1800)
    },
  },

  {
    id: 'portal',
    titulo: 'El portal y el tope',
    async grabar(u) {
      const { empezar, narrar, mirar, esperar, reposo, p } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=PORTAL DEL CLIENTE')
      empezar()
      await narrar(0, { mirar: 'text=PORTAL DEL CLIENTE', escala: 1.6 })
      await narrar(1, {
        hacer: async () => {
          await mirar('button:has-text("Activar portal"):visible', { escala: 1.6, ms: 2600 })
        },
      })
      await narrar(2, {
        hacer: async () => {
          await p.locator('text=TOPE DE PRÉSTAMO').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(600)
          await mirar('text=TOPE DE PRÉSTAMO', { escala: 1.6, ms: 2600 })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=CÓMO PAGA')
      empezar()
      await narrar(0, { mirar: 'text=CÓMO PAGA >> visible=true', escala: 1.6 })
      await narrar(1)
      await narrar(2)
      await reposo(2200)
    },
  },
]

const cookie = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo', rol: 'owner',
    organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'clientes',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-14',
  final: '/home/keyce/Desktop/videos-tutoriales/14-clientes.mp4',
  tomas: TOMAS,
  cookie,
})
