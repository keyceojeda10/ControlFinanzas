// scripts/video-demo/v21-instalar-app.mjs
//
// VÍDEO 21 · Cómo instalar la app en tu teléfono
//
//     node scripts/video-demo/voz.mjs 21-instalar-app --solo-audio
//     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=21-instalar-app \
//       node scripts/video-demo/v21-instalar-app.mjs
//
// Es de lo que más se pregunta al soporte, y la respuesta desconcierta porque no
// está en ninguna tienda: se instala desde el propio navegador.
//
// ── ⚠ ANDROID Y IPHONE SE GRABAN FALSEANDO EL NAVEGADOR ────────────────────
//
// No hay un iPhone al otro lado. Esas dos tomas abren el contexto con el
// `userAgent` de un iPhone con Safari y de un Android con Chrome, y la
// aplicación —que YA detecta el navegador y enseña los pasos que tocan
// (`components/layout/InstallButton.jsx:131`)— pinta ella sola las
// instrucciones. **Nada de lo que sale en pantalla está inventado**: son las
// mismas que vería el usuario en su teléfono.
//
// ⚠ Y HAY QUE FALSEARLO, porque lo que sale por defecto son las instrucciones de
//   ESCRITORIO: «busca el icono en la barra de direcciones… Windows o Mac». En
//   un vídeo vertical para el teléfono, eso sería mentir. Lo vi probándolo, no
//   leyendo el código.
//
// `toma.contexto` no existe en el grabador, así que el cambio de navegador se
// hace con `toma.userAgent`, que sí se pasa al crear el contexto.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const MENU = 'nav[aria-label="Navegación principal"]'

const UA_IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) ' +
  'AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
const UA_ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36'

const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** «Más» → «Configuración», que es donde vive el botón. */
const hastaConfiguracion = async (u) => {
  await enElPanel(u)
  await u.tocarSel(`${MENU} a[href="/mas"]`)
  await u.esperar(2400)
  await u.tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
  await u.esperar(3600)
}

/** Y de ahí, con la hoja de pasos abierta. */
const conLosPasos = async (u) => {
  await hastaConfiguracion(u)
  await u.p.locator('button:has-text("Instalar en este dispositivo")').first()
    .scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(800)
  await u.tocarSel('button:has-text("Instalar en este dispositivo")')
  await u.esperar(2600)
}

const TOMAS = [
  {
    id: 'no_esta_en_la_tienda',
    titulo: 'No está en la tienda',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0)
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'donde_esta',
    titulo: 'Dónde está el botón',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo, p } = u
      await enElPanel(u)
      empezar()
      await esperar(600)
      await narrar(0, {
        mirar: `${MENU} a[href="/mas"]`, escala: 2.4,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/mas"]`)
          await esperar(1600)
          await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
          await esperar(2600)
        },
      })
      await narrar(1, {
        hacer: async () => {
          await p.locator('button:has-text("Instalar en este dispositivo")').first()
            .scrollIntoViewIfNeeded().catch(() => {})
          await esperar(900)
        },
        mirar: 'text=Instalar la app >> visible=true', escala: 1.7,
      })
      await reposo(1600)
    },
  },

  {
    id: 'segun_tu_telefono',
    titulo: 'Te dice los pasos de tu teléfono',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo, p } = u
      await hastaConfiguracion(u)
      await p.locator('button:has-text("Instalar en este dispositivo")').first()
        .scrollIntoViewIfNeeded().catch(() => {})
      await esperar(800)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Instalar en este dispositivo")', escala: 1.8,
        hacer: async () => {
          await tocarSel('button:has-text("Instalar en este dispositivo")')
          await esperar(2400)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'android',
    titulo: 'En Android',
    userAgent: UA_ANDROID,
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await conLosPasos(u)
      empezar()
      await narrar(0, { mirar: 'text=Instalar desde Chrome >> visible=true', escala: 1.6 })
      await narrar(1)
      await reposo(1800)
    },
  },

  {
    id: 'iphone',
    titulo: 'En iPhone',
    userAgent: UA_IPHONE,
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await conLosPasos(u)
      empezar()
      /* ⚠ UN SOLO ACERCAMIENTO. Puse dos y el montaje avisó: «a 0,7s uno de
         otro, se ve como un tirón». Las dos frases son cortas y los zooms se
         montaban. Se queda el de los pasos, que es lo que hay que leer. */
      await narrar(0)
      await narrar(1, { mirar: 'text=Agregar a pantalla de inicio >> visible=true', escala: 1.4, fila: true })
      await reposo(2000)
    },
  },

  {
    id: 'para_que_sirve',
    titulo: 'Para qué sirve instalarla',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaConfiguracion(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=usarla sin internet >> visible=true', escala: 1.6, fila: true })
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
  nombre: 'instalar la app',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-21',
  final: '/home/keyce/Desktop/videos-tutoriales/21-instalar-app.mp4',
  tomas: TOMAS,
  cookie,
})
