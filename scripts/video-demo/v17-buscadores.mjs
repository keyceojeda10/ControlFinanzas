// scripts/video-demo/v17-buscadores.mjs
//
// VÍDEO 17 · Los buscadores: cuáles hay y para qué sirve cada uno
//
//     node scripts/video-demo/v17-buscadores.mjs
//     node scripts/video-demo/v17-buscadores.mjs --toma 4
//
// Pedido del dueño: «explicar los distintos tipos de buscadores, dónde están y
// qué se puede realizar con cada uno».
//
// Y hacen falta, porque no son el mismo buscador cuatro veces: son cuatro cosas
// distintas con la misma pinta, y quien no lo sabe usa la lupa para filtrar una
// lista —que no es lo que hace— y no encuentra nada.
//
//   1. LA LUPA de arriba (o Ctrl+K en el computador). Busca en TODO el negocio:
//      clientes, préstamos, rutas, pantallas y las guías de cómo se hace cada
//      cosa. Es la única que te lleva a otro sitio.
//   2. EL DE CADA LISTA («Nombre o cédula»). No te lleva a ningún lado: FILTRA
//      lo que estás viendo. En clientes busca clientes y en préstamos, el
//      cliente del préstamo.
//   3. «¿QUÉ NECESITAS HACER AQUÍ?». No busca cosas: busca ACCIONES, y las de
//      la pantalla en la que estás. Sale en la ficha del cliente, en la del
//      préstamo, en la caja, en la ruta y en cobradores.
//   4. EL DE ELEGIR CLIENTE, al hacer un préstamo. Busca dentro de tus
//      clientes para escoger uno. Se nombra porque es donde más se traba la
//      gente: «RECIENTES» solo enseña tres.
//
// ── ⚠ LA LUPA SE ABRE CON EL TECLADO EN LA GRABACIÓN ───────────────────────
//
// `Control+k` es lo que usa el buscador (`GlobalSearch.jsx:107`). En el vídeo se
// enseña el icono —que es como se abre en el teléfono— y se pulsa; el atajo se
// nombra en la voz para quien esté en el computador.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const CLIENTE = 'Marta Elena Ospina'

const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** Abre la lupa. Se pulsa el icono, que es lo que hace el usuario del móvil. */
const abrirLupa = async (u) => {
  await u.tocarSel('[aria-label="Buscar"]:visible')
  await u.esperar(2200)
}

/** El campo del buscador general, que es el único visible con el modal abierto. */
const CAMPO = 'input:visible'

/* ⚠ «ÚLTIMOS QUE ABRISTE» NO SALE EN UNA VENTANA RECIÉN ABIERTA.
   La lista de recientes vive en el navegador, y cada toma estrena contexto: sin
   haber abierto a nadie, ese bloque no existe y la toma se queda esperando un
   rótulo que no va a llegar. Así que se visita una ficha ANTES de `empezar()`.
   Se descubrió grabando; sondeando a mano no se ve, porque a mano uno ya ha
   estado paseando por la aplicación. */
const dejarUnReciente = async (u) => {
  await u.tocarSel('a[href="/clientes"]:visible')
  await u.esperar(2600)
  await u.tocar(CLIENTE)
  await u.esperar(3200)
  await u.tocarSel('a[href="/dashboard"]:visible')
  await u.esperar(2600)
}

/* El ritmo lo pone la voz: `narrar(i)` dura lo que dura su frase. Ver la nota
   larga de `grabador.mjs`.

     node scripts/video-demo/voz.mjs 17-buscadores --solo-audio
     SIN_ROTULOS=1 LOCUCION=17-buscadores node scripts/video-demo/v17-buscadores.mjs */
const TOMAS = [
  {
    id: 'la_lupa',
    titulo: 'La lupa: dónde está y qué abre',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0)
      await narrar(1, {
        mirar: '[aria-label="Buscar"]:visible', escala: 2.4,
        hacer: async () => { await abrirLupa(u) },
      })
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'en_reposo',
    titulo: 'Lo que ofrece sin escribir nada',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await enElPanel(u)
      await dejarUnReciente(u)
      await abrirLupa(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=ÚLTIMOS QUE ABRISTE', escala: 1.6 })
      await narrar(2, { mirar: 'text=IR DIRECTO A', escala: 1.6 })
      await reposo(1600)
    },
  },

  {
    id: 'buscar_persona',
    titulo: 'Escribe un nombre',
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, reposo, p } = u
      await enElPanel(u)
      await dejarUnReciente(u)
      await abrirLupa(u)
      empezar()
      /* Se escribe DOS veces —un nombre y una cédula— porque la frase nombra las
         tres formas y con una sola búsqueda no se ve que acepta el número. */
      await narrar(0, {
        hacer: async () => {
          await escribir(CAMPO, 'Marta'); await esperar(1800)
          await p.locator(CAMPO).first().fill(''); await esperar(400)
          await escribir(CAMPO, '46201'); await esperar(1600)
        },
      })
      await narrar(1)
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'buscar_accion',
    titulo: 'O escribe lo que quieres hacer',
    async grabar(u) {
      const { esperar, empezar, narrar, escribir, reposo, p } = u
      await enElPanel(u)
      await abrirLupa(u)
      empezar()
      await narrar(0)
      await narrar(1, {
        hacer: async () => { await escribir(CAMPO, 'renovar'); await esperar(2400) },
      })
      /* Y una segunda palabra: que se vea que no es un truco de una sola. */
      await narrar(2, {
        hacer: async () => {
          await p.locator(CAMPO).first().fill(''); await esperar(400)
          await escribir(CAMPO, 'cancelar'); await esperar(2200)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'el_de_la_lista',
    titulo: 'El de cada lista: filtra, no te lleva',
    async grabar(u) {
      const CAMPO_LISTA = 'input[placeholder="Nombre o cédula"]:visible'
      const { esperar, empezar, narrar, escribir, tocarSel, reposo } = u
      await enElPanel(u)
      await tocarSel('a[href="/clientes"]:visible')
      await esperar(3000)
      empezar()
      await narrar(0, { mirar: CAMPO_LISTA, escala: 1.8 })
      await narrar(1, {
        hacer: async () => { await escribir(CAMPO_LISTA, 'Marta'); await esperar(1800) },
      })
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'en_prestamos',
    titulo: 'El mismo, en préstamos',
    async grabar(u) {
      const CAMPO_LISTA = 'input[placeholder="Nombre o cédula"]:visible'
      const { esperar, empezar, narrar, escribir, tocar, tocarSel, reposo } = u
      await enElPanel(u)
      await tocarSel('a[href="/prestamos"]:visible')
      await esperar(3200)
      empezar()
      await narrar(0, {
        hacer: async () => { await escribir(CAMPO_LISTA, 'Marta'); await esperar(1800) },
      })
      /* Y se combina con un filtro, que es literalmente lo que dice la frase. */
      await narrar(1, {
        hacer: async () => { await tocar('En mora'); await esperar(1800) },
      })
      await reposo(1600)
    },
  },

  {
    id: 'que_necesitas',
    titulo: '¿Qué necesitas hacer aquí?',
    async grabar(u) {
      const CAJA = 'input[placeholder*="necesitas"]'
      const { esperar, empezar, narrar, escribir, tocarSel, tocar, reposo, p } = u
      await enElPanel(u)
      await tocarSel('a[href="/clientes"]:visible')
      await esperar(3000)
      await tocar(CLIENTE)
      await esperar(3800)
      await p.locator(CAJA).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1200)
      empezar()
      await narrar(0, { mirar: CAJA, escala: 1.7 })
      await narrar(1, {
        hacer: async () => { await escribir(CAJA, 'cancelar'); await esperar(2400) },
      })
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'cierre',
    titulo: 'Cuál usar para qué',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0)
      await narrar(1, { mirar: '[aria-label="Buscar"]:visible', escala: 2.4 })
      await narrar(2)
      await narrar(3)
      await reposo(2000)
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
  nombre: 'buscadores',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-17',
  final: '/home/keyce/Desktop/videos-tutoriales/17-buscadores.mp4',
  tomas: TOMAS,
  cookie,
})
