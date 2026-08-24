// scripts/video-demo/v20-cargar-datos.mjs
//
// VÍDEO 20 · Cómo pasar tu cuaderno o tu Excel
//
//     node scripts/video-demo/voz.mjs 20-cargar-datos --solo-audio
//     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=20-cargar-datos \
//       node scripts/video-demo/v20-cargar-datos.mjs
//
// Corto y al grano: dónde están las tres formas de meter la cartera de golpe.
// Existe porque el vídeo 16 solo las NOMBRA, y quien viene de un cuaderno con
// ochenta clientes no va a teclearlos uno a uno: o encuentra esto, o no se
// queda.
//
// ⚠ NO SE SUBE NINGUNA FOTO NI NINGÚN EXCEL EN CÁMARA. Se enseña dónde está y
//   qué hace cada camino; cargar de verdad crearía clientes en el negocio de
//   mentira y el vídeo siguiente se los encontraría dentro.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

/* ⚠ LA BARRA DE ABAJO SE APUNTA POR EL `nav`, NO POR EL `href` A SECAS: en el
   panel hay más enlaces a las mismas rutas y `.first()` coge el que va antes en
   el DOM, que suele ser un «Ver todos» de una tarjeta. */
const MENU = 'nav[aria-label="Navegación principal"]'

const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** «Más» → «Pasar mi cuaderno», que es por donde se llega. */
const hastaCargar = async (u) => {
  await enElPanel(u)
  await u.tocarSel(`${MENU} a[href="/mas"]`)
  await u.esperar(2400)
  await u.tocarSel('button:has-text("Pasar mi cuaderno"):visible, a:has-text("Pasar mi cuaderno"):visible')
  await u.esperar(3600)
}

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde está',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0)
      await narrar(1, {
        mirar: `${MENU} a[href="/mas"]`, escala: 2.4,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/mas"]`)
          await esperar(1800)
          await tocarSel('button:has-text("Pasar mi cuaderno"):visible, a:has-text("Pasar mi cuaderno"):visible')
          await esperar(2600)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'tres_caminos',
    titulo: 'Tres caminos',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { mirar: 'text=¿Cómo lo pasamos? >> visible=true', escala: 1.6 })
      await reposo(1400)
    },
  },

  {
    id: 'cuaderno_entero',
    titulo: 'El cuaderno entero',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { mirar: 'text=Pasar todo el cuaderno >> visible=true', escala: 1.6, fila: true })
      await narrar(1, { mirar: 'text=hasta 30 de una vez >> visible=true', escala: 1.5, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'una_cartulina',
    titulo: 'Una cartulina',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { mirar: 'text=Tómale foto a la cartulina >> visible=true', escala: 1.6, fila: true })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'a_mano',
    titulo: 'A mano',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { mirar: 'text=Escribir uno a mano >> visible=true', escala: 1.6, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'excel',
    titulo: 'El Excel',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { /* ⚠ SIN TILDES: en la pantalla pone «Tienes un archivo Excel? Importalo
           aqui», sin acentos ni signo de apertura. Escrito bien no casa con
           nada y la toma se queda esperando. Se ancla a «archivo Excel», que
           es lo mismo y no depende de cómo esté acentuado. */
        mirar: 'text=archivo Excel >> visible=true', escala: 1.7, fila: true })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Tú revisas antes',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCargar(u)
      empezar()
      await narrar(0, { mirar: 'text=Tú revisas antes de guardar >> visible=true', escala: 1.5, fila: true })
      await narrar(1)
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
  nombre: 'cargar datos',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-20',
  final: '/home/keyce/Desktop/videos-tutoriales/20-cargar-datos.mp4',
  tomas: TOMAS,
  cookie,
})
