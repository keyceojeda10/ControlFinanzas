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

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde están tus clientes',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(1400)
      await decir('Tus clientes están en la barra de abajo, en el segundo icono', 4.8)
      await esperar(1400)
      await mirar('a[href="/clientes"]:visible', { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocarSel('a[href="/clientes"]:visible')
      await esperar(3200)
      await decir('Y aquí están todos, uno debajo de otro', 4.0)
      await esperar(4200)
      await reposo(3200)
    },
  },

  {
    id: 'la_ficha_de_la_lista',
    titulo: 'Lo que dice cada uno sin abrirlo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaClientes(u)
      empezar()
      await decir('Cada uno te dice lo suyo sin tener que abrirlo', 4.4)
      await esperar(4600)
      await mirar('text=Wilmer Andrés Salas', { escala: 1.5, ms: 4400, fila: true })
      await esperar(2600)
      await decir('Cuánto debe, cuántos días lleva atrasado y de qué ruta es', 5.0)
      await esperar(5200)
      await decir('Y abajo: el atraso, cómo va cumpliendo y cuánto lleva pagado', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'buscador',
    titulo: 'Buscar a uno',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, reposo } = u
      await hastaClientes(u)
      empezar()
      await decir('Arriba tienes el buscador de esta lista', 4.0)
      await esperar(1400)
      await mirar('input[placeholder="Nombre o cédula"]:visible', { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await decir('Busca por nombre o por cédula, y va filtrando mientras escribes', 5.2)
      await esperar(2200)
      await escribir('input[placeholder="Nombre o cédula"]:visible', 'Marta')
      await esperar(3400)
      await reposo(3400)
    },
  },

  {
    id: 'filtros',
    titulo: 'Los filtros',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaClientes(u)
      empezar()
      await decir('Debajo del buscador están los filtros, con su número al lado', 5.0)
      await esperar(1600)
      await mirar('button:has-text("En mora"):visible', { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await decir('Así ves solo a los que están en mora, o solo a los que están al día', 5.2)
      await esperar(2000)
      await tocar('En mora')
      await esperar(3000)
      await decir('El número te dice cuántos hay antes de tocarlo', 4.2)
      await esperar(4400)
      await reposo(3200)
    },
  },

  {
    id: 'vistas',
    titulo: 'Cómo se ven',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaClientes(u)
      empezar()
      await decir('Y puedes cambiar cómo se ven', 3.6)
      await esperar(1400)
      await mirar('[aria-label="Cuadrícula"]:visible', { escala: 2.4, ms: 3400 })
      await esperar(2400)
      await tocarSel('[aria-label="Cuadrícula"]:visible')
      await esperar(3000)
      await decir('En cuadrícula caben muchos más de un vistazo', 4.4)
      await esperar(4600)
      await decir('Y en el computador tienes además la tabla', 4.0)
      await esperar(4200)
      await reposo(3400)
    },
  },

  {
    id: 'abrir',
    titulo: 'La ficha del cliente',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaClientes(u)
      empezar()
      await decir('Y tocando a cualquiera entras en su ficha', 4.2)
      await esperar(2200)
      await tocar(CLIENTE)
      await esperar(3800)
      await decir('Arriba, lo que te importa: cuánto te debe y cuánto es la cuota', 5.2)
      await esperar(1600)
      await mirar('text=SALDO TOTAL PENDIENTE', { escala: 1.6, ms: 4400, fila: true })
      await esperar(3600)
      await reposo(3400)
    },
  },

  {
    id: 'lucas',
    titulo: 'Lo que te sugiere Lucas',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=Lucas te sugiere')
      empezar()
      await decir('Debajo, Lucas te dice cómo va este cliente', 4.2)
      await esperar(1400)
      await mirar('text=Lucas te sugiere', { escala: 1.6, ms: 4200 })
      await esperar(2800)
      await decir('No es un número: es qué hacer con él, escrito', 4.4)
      await esperar(4600)
      await reposo(3200)
    },
  },

  {
    id: 'prestamos',
    titulo: 'Sus préstamos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=PRÉSTAMOS ACTIVOS')
      empezar()
      await decir('Después van sus préstamos', 3.4)
      await esperar(1400)
      await mirar('text=PRÉSTAMOS ACTIVOS', { escala: 1.6, ms: 4000 })
      await esperar(2600)
      await decir('Si tiene varios, salen todos aquí, y entras a cualquiera tocándolo', 5.2)
      await esperar(5400)
      await decir('Y el botón de abajo es para hacerle uno nuevo', 4.2)
      await esperar(4400)
      await reposo(3200)
    },
  },

  {
    id: 'acciones',
    titulo: 'Todo lo que puedes hacerle',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'button:has-text("Historial"):visible')
      empezar()
      await decir('Y esta fila es todo lo que puedes hacerle a este cliente', 5.0)
      await esperar(1600)
      await mirar('button:has-text("Historial"):visible', { escala: 1.5, ms: 4400, fila: true })
      await esperar(3000)
      await decir('Mandarle un mensaje, reagendarle la visita, arreglarle la ubicación', 5.2)
      await esperar(5400)
      await decir('Ver su historial, sacarle el QR, editarlo, inactivarlo o eliminarlo', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
  },

  {
    id: 'borrar',
    titulo: 'Cómo se borra un cliente',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'button:has-text("Eliminar"):visible')
      empezar()
      await decir('Esto es lo que más nos preguntan: cómo se borra un cliente', 5.0)
      await esperar(1600)
      await mirar('button:has-text("Eliminar"):visible', { escala: 2.0, ms: 4000 })
      await esperar(2800)
      await tocarSel('button:has-text("Eliminar"):visible')
      await esperar(3000)
      await decir('Te pregunta antes, porque esto no se puede deshacer', 4.6)
      await esperar(4800)
      /* ⚠ SE PULSA DE VERDAD, Y ES SEGURO: este cliente tiene un préstamo
         activo, así que el sistema RECHAZA el borrado. Es justo lo que hay que
         enseñar —el «no me deja»— y no se pierde nada.

         ⚠ Y EL BOTÓN ES EL DEL MODAL, no el de la página. `:visible` no basta:
         el de detrás también lo está, el selector lo cogía primero y Playwright
         se quedaba diez segundos diciendo que «el overlay intercepta el clic».
         Se ancla al `.fixed.inset-0`, que es la caja del modal. */
      await tocarSel('.fixed.inset-0 button:has-text("Eliminar")')
      await esperar(3600)
      await decir('Y si tiene préstamos abiertos, no te deja: te dice qué hacer con ellos', 5.6)
      await esperar(5800)
      await reposo(4000)
    },
  },

  {
    id: 'portal',
    titulo: 'El portal y el tope',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=PORTAL DEL CLIENTE')
      empezar()
      await decir('Más abajo hay dos cosas que casi nadie usa y valen mucho', 5.0)
      await esperar(1600)
      await mirar('text=PORTAL DEL CLIENTE', { escala: 1.6, ms: 4000 })
      await esperar(2600)
      await decir('El portal: le das un PIN y él ve sus pagos desde su celular', 5.0)
      await esperar(2400)
      await mirar('text=TOPE DE PRÉSTAMO', { escala: 1.6, ms: 4000 })
      await esperar(2600)
      await decir('Y el tope: hasta cuánto le puedes prestar a este, y no más', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaLaFicha(u)
      await bajarHasta(u, 'text=CÓMO PAGA')
      empezar()
      await decir('Y al final, cómo ha pagado mes a mes', 4.2)
      await esperar(1400)
      await mirar('text=CÓMO PAGA >> visible=true', { escala: 1.6, ms: 4200 })
      await esperar(2800)
      await decir('Eso es la ficha entera. Cada cosa está donde la ves', 4.6)
      await esperar(4800)
      await decir('Y si no encuentras algo, el buscador de arriba lo sabe', 4.6)
      await esperar(4800)
      await reposo(3800)
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
