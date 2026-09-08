// scripts/video-demo/v23-asignar-ruta.mjs
//
// VÍDEO 23 · Cómo asignarle una ruta a un cobrador
//
//     node scripts/video-demo/voz.mjs 23-asignar-ruta --solo-audio      # 1 · el audio
//     SIN_ROTULOS=1 LOCUCION=23-asignar-ruta \
//       node scripts/video-demo/v23-asignar-ruta.mjs                # 2 · grabar
//     node scripts/video-demo/voz.mjs 23-asignar-ruta                  # 3 · voz
//     node scripts/video-demo/subtitulos.mjs 23-asignar-ruta --quemar  # 4 · subtitulos
//
// ⚠ `SIN_ROTULOS=1` NO ES OPCIONAL. Sin él, el grabador QUEMA los rótulos
//   negros en la imagen, y encima van los subtítulos: el vídeo sale con el
//   mismo texto dos veces. Pasó con la primera versión de estos dos.
//     node scripts/video-demo/v23-asignar-ruta.mjs --toma 2
//     node scripts/video-demo/v23-asignar-ruta.mjs --pegar
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
//
// La duda sale tal cual en las conversaciones del bot:
//
//     «Amigo, ¿y a esa ruta le puedo asignar un cobrador o qué?»
//     «Yo como administrador y a esa ruta asignarle al cobrador no me puede, ¿no?»
//
// Ya tienen la ruta y ya tienen el cobrador; lo que no encuentran es dónde se
// juntan. Se juntan DENTRO de la ruta, en el lápiz de la cabecera, y por eso
// el vídeo entra por ahí en vez de por la pantalla de cobradores.
//
// ── ⚠ EL LÁPIZ, NO «CAMBIAR COBRADOR» ─────────────────────────────────────
//
// En escritorio hay un botón que dice «Cambiar cobrador». En el móvil —que es
// donde se ve este vídeo— ESE BOTÓN NO EXISTE: está en el árbol de escritorio,
// oculto. Lo que hay es el lápiz de la cabecera, `aria-label="Editar la ruta"`,
// que abre nombre y cobrador. Grabar el del escritorio habría enseñado un
// botón que el cliente no va a encontrar en su teléfono.
//
// El vídeo 13 ya lo explica en su toma 10, a partir del 3:40, pero dura 5:39 y
// va de crear cobradores: quien pregunta esto no va a mirarlo entero.
//
// ── ⚠ LA ÚLTIMA TOMA VA CON LA SESIÓN DEL COBRADOR ────────────────────────
//
// `toma.cookie` con el token de Andrés Vargas. Es la única forma de enseñar lo
// que ve él —su ruta y solo la suya— sin falsear ni una pantalla.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const MENU = 'nav[aria-label="Navegación principal"]'

const enRutas = async (u) => {
  await u.ir('/rutas', /Rutas|Ruta Centro/i)
  await u.esperar(1400)
}

const enLaRuta = async (u) => {
  await u.ir(`/rutas/${IDS.ruta}`, /Ruta Centro|CLIENTES/i)
  await u.esperar(1600)
}

const TOMAS = [
  {
    id: 'quien_lleva_cada_ruta',
    titulo: 'Quién lleva cada ruta',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enRutas(u)
      empezar()
      await esperar(700)
      await narrar(0, { mirar: 'text=Ruta Centro >> visible=true', escala: 1.6, fila: true })
      await esperar(900)   // dos acercamientos pegados se ven como un tirón
      /* «Sin ruta · 5 clientes · sin cobrador» está de verdad en la pantalla:
         el negocio de demostración deja cinco clientes fuera a propósito. */
      await narrar(1, { mirar: 'text=sin cobrador >> visible=true', escala: 1.7, fila: true })
      await reposo(1800)
    },
  },

  {
    id: 'dentro_de_la_ruta',
    titulo: 'Se hace dentro de la ruta',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await enRutas(u)
      empezar()
      await narrar(0, {
        mirar: 'text=Ruta Centro >> visible=true', escala: 1.5, fila: true,
        hacer: async () => {
          /* ⚠ `:visible`. La app pinta el árbol de móvil y el de escritorio a
             la vez, y el invisible va primero en el DOM: sin esto la toma se
             queda diez segundos esperando a que se deje pulsar. */
          await tocarSel('[role="button"]:has-text("Ruta Centro"):visible, button:has-text("Ruta Centro"):visible')
          await esperar(2600)
        },
      })
      await narrar(1, { mirar: '[aria-label="Editar la ruta"]', escala: 2.6 })
      await reposo(2000)
    },
  },

  {
    id: 'eliges_cual',
    titulo: 'Eliges cuál',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await enLaRuta(u)
      empezar()
      await narrar(0, {
        mirar: '[aria-label="Editar la ruta"]', escala: 2.4,
        hacer: async () => {
          await tocarSel('[aria-label="Editar la ruta"]')
          await esperar(2800)
        },
      })
      await narrar(1)
      await reposo(2200)
    },
  },

  {
    id: 'lo_que_ve_el',
    titulo: 'Lo que ve él',
    cookie: await encode({
      token: {
        sub: IDS.cobrador, id: IDS.cobrador, email: 'demo-cobrador@ejemplo.invalid',
        name: 'Andrés Vargas', rol: 'cobrador', organizationId: IDS.org,
        plan: 'professional', country: 'co', orgNombre: 'Créditos del Valle',
        rutaIds: [IDS.ruta],
      },
      secret: SECRETO,
    }),
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await u.ir('/dashboard', /Buenos|Buenas|Recaudado|Ruta/i)
      await esperar(1400)
      empezar()
      await narrar(0, {
        mirar: `${MENU} a[href="/rutas"]`, escala: 2.0,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/rutas"]`)
          await esperar(2600)
        },
      })
      await narrar(1, { mirar: 'text=Ruta Centro >> visible=true', escala: 1.5, fila: true })
      await reposo(2400)
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
  nombre: 'asignar una ruta a un cobrador',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-23',
  final: '/home/keyce/Desktop/videos-tutoriales/23-asignar-ruta.mp4',
  tomas: TOMAS,
  cookie,
})
