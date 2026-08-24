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

const TOMAS = [
  {
    id: 'la_lupa',
    titulo: 'La lupa: dónde está y qué abre',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(1400)
      await decir('En el sistema hay cuatro buscadores, y no hacen lo mismo', 5.0)
      await esperar(5200)
      await decir('El primero es la lupa de arriba', 3.4)
      await esperar(1400)
      await mirar('[aria-label="Buscar"]:visible', { escala: 2.4, ms: 3600 })
      await esperar(2600)
      await abrirLupa(u)
      await decir('En el computador se abre con la tecla control y la K', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },

  {
    id: 'en_reposo',
    titulo: 'Lo que ofrece sin escribir nada',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await enElPanel(u)
      await dejarUnReciente(u)
      await abrirLupa(u)
      empezar()
      await decir('Sin escribir nada ya te ofrece dos cosas', 4.2)
      await esperar(4400)
      await mirar('text=ÚLTIMOS QUE ABRISTE', { escala: 1.6, ms: 4200 })
      await esperar(2800)
      await decir('Los últimos clientes que abriste, para volver de un toque', 4.8)
      await esperar(2000)
      await mirar('text=IR DIRECTO A', { escala: 1.6, ms: 4200 })
      await esperar(2600)
      await decir('Y atajos a las pantallas: la caja, tu plata, los gastos, los reportes', 5.6)
      await esperar(5800)
      await reposo(3400)
    },
  },

  {
    id: 'buscar_persona',
    titulo: 'Escribe un nombre',
    async grabar(u) {
      const { esperar, empezar, decir, escribir, reposo } = u
      await enElPanel(u)
      await abrirLupa(u)
      empezar()
      await decir('Escribe un nombre, o una cédula, o un teléfono', 4.4)
      await esperar(1600)
      await escribir(CAMPO, 'Marta')
      await esperar(3600)
      await decir('Y te lo encuentra con lo que te debe, sin entrar a ningún lado', 5.2)
      await esperar(5400)
      await decir('Esta es la única que te saca de la pantalla y te lleva a él', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'buscar_accion',
    titulo: 'O escribe lo que quieres hacer',
    async grabar(u) {
      const { esperar, empezar, decir, escribir, reposo } = u
      await enElPanel(u)
      await abrirLupa(u)
      empezar()
      await decir('Y esto es lo que casi nadie sabe: también busca lo que quieres hacer', 5.6)
      await esperar(1800)
      await escribir(CAMPO, 'renovar')
      await esperar(3800)
      await decir('Escribes renovar y te saca la guía de cómo se renueva, con capturas', 5.6)
      await esperar(5800)
      await decir('Hay una guía para casi todo. No hace falta saber dónde está', 5.0)
      await esperar(5200)
      await reposo(3600)
    },
  },

  {
    id: 'el_de_la_lista',
    titulo: 'El de cada lista: filtra, no te lleva',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, tocarSel, reposo } = u
      await enElPanel(u)
      await tocarSel('a[href="/clientes"]:visible')
      await esperar(3200)
      empezar()
      await decir('El segundo buscador es el de cada lista', 4.2)
      await esperar(1400)
      await mirar('input[placeholder="Nombre o cédula"]:visible', { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await decir('Este NO te lleva a ningún lado: filtra lo que estás viendo', 5.0)
      await esperar(1800)
      await escribir('input[placeholder="Nombre o cédula"]:visible', 'Marta')
      await esperar(3400)
      await decir('Se queda aquí y deja solo los que coinciden', 4.4)
      await esperar(4600)
      await reposo(3400)
    },
  },

  {
    id: 'en_prestamos',
    titulo: 'El mismo, en préstamos',
    async grabar(u) {
      const { esperar, empezar, decir, escribir, tocarSel, reposo } = u
      await enElPanel(u)
      await tocarSel('a[href="/prestamos"]:visible')
      await esperar(3400)
      empezar()
      await decir('En préstamos hay otro igual, y busca por el cliente del préstamo', 5.4)
      await esperar(1800)
      await escribir('input[placeholder="Nombre o cédula"]:visible', 'Marta')
      await esperar(3400)
      await decir('Y se combina con los filtros: en mora, y de esos, este', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },

  {
    id: 'que_necesitas',
    titulo: '¿Qué necesitas hacer aquí?',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, tocarSel, tocar, reposo, p } = u
      await enElPanel(u)
      await tocarSel('a[href="/clientes"]:visible')
      await esperar(3000)
      await tocar(CLIENTE)
      await esperar(3800)
      await p.locator('input[placeholder*="necesitas"]').first()
        .scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1400)
      empezar()
      await decir('El tercero es este, y sale dentro de las fichas', 4.4)
      await esperar(1400)
      await mirar('input[placeholder*="necesitas"]', { escala: 1.7, ms: 4000 })
      await esperar(2600)
      await decir('Este no busca cosas: busca lo que puedes hacer en esta pantalla', 5.2)
      await esperar(1800)
      await escribir('input[placeholder*="necesitas"]', 'cancelar')
      await esperar(3600)
      await decir('Escribes lo que quieres y te lo deja hecho, o te explica cómo', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Cuál usar para qué',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(1600)
      await decir('Resumiendo, y con esto no te equivocas', 4.2)
      await esperar(4400)
      await decir('Si buscas a alguien o no sabes dónde está algo: la lupa de arriba', 5.4)
      await esperar(1600)
      await mirar('[aria-label="Buscar"]:visible', { escala: 2.4, ms: 3600 })
      await esperar(3000)
      await decir('Si quieres reducir una lista que ya tienes delante: el de la lista', 5.2)
      await esperar(5400)
      await decir('Y si quieres hacer algo y no encuentras el botón: el de la ficha', 5.2)
      await esperar(5400)
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
  nombre: 'buscadores',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-17',
  final: '/home/keyce/Desktop/videos-tutoriales/17-buscadores.mp4',
  tomas: TOMAS,
  cookie,
})
