// scripts/video-demo/v22-volver-a-entrar.mjs
//
// VÍDEO 22 · Cómo volver a entrar
//
//     node scripts/video-demo/voz.mjs 22-volver-a-entrar --solo-audio      # 1 · el audio
//     SIN_ROTULOS=1 LOCUCION=22-volver-a-entrar \
//       node scripts/video-demo/v22-volver-a-entrar.mjs                # 2 · grabar
//     node scripts/video-demo/voz.mjs 22-volver-a-entrar                  # 3 · voz
//     node scripts/video-demo/subtitulos.mjs 22-volver-a-entrar --quemar  # 4 · subtitulos
//
// ⚠ `SIN_ROTULOS=1` NO ES OPCIONAL. Sin él, el grabador QUEMA los rótulos
//   negros en la imagen, y encima van los subtítulos: el vídeo sale con el
//   mismo texto dos veces. Pasó con la primera versión de estos dos.
//     node scripts/video-demo/v22-volver-a-entrar.mjs --toma 3
//     node scripts/video-demo/v22-volver-a-entrar.mjs --pegar
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
//
// Es la pregunta NÚMERO UNO del soporte por WhatsApp: 38 de las 204 preguntas
// que se midieron el 2 sep 2026, de 28 personas distintas. Y no preguntan cómo
// se usa el sistema, preguntan dónde está:
//
//     «Me puedes mandar el link de donde se abre la aplicación»
//     «Cómo se llama la app?»
//
// Entraron una vez desde un enlace que les mandamos, cerraron el navegador y
// perdieron la puerta.
//
// ── ⚠ LAS CUATRO PRIMERAS TOMAS VAN SIN SESIÓN ────────────────────────────
//
// `cookie: ''` en la toma hace que el grabador NO ponga la galleta, y entonces
// se ve la pantalla de entrar de verdad, que es de lo que trata el vídeo. Con
// la sesión puesta, `/login` redirige al panel y la toma sale en otra pantalla.
//
// ── ⚠ Y NO SE HACE UN ACCESO DE MENTIRA ───────────────────────────────────
//
// El usuario de demostración tiene un hash de relleno (`montar-demo.mjs`): al
// espejo se entra por JWT firmado, no por contraseña. Así que la toma del
// correo ESCRIBE los datos y se queda mirando el botón, sin pulsarlo. Pulsar y
// que saliera «credenciales incorrectas» sería enseñar un fallo que el cliente
// no va a tener; y falsear la pantalla siguiente sería mentir. La última toma
// ya arranca dentro, que es donde se ve que sus cosas siguen ahí.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const MENU = 'nav[aria-label="Navegación principal"]'

const CORREO = 'input[placeholder*="correo"]'
const CLAVE = 'input[type="password"]'

/* El correo que se teclea en cámara. Inventado y evidentemente de ejemplo, por
   lo mismo que las cédulas: YouTube retiró el vídeo 06 el 8 sep 2026 leyendo
   unos datos de atrezzo como personales. `ejemplo.com` no es de nadie. */
const CORREO_DEMO = 'sofia@ejemplo.com'

const enLaPantallaDeEntrar = async (u) => {
  await u.ir('/login', /Entra a tu cartera|Correo/i)
  await u.esperar(1000)
}

const TOMAS = [
  {
    id: 'la_direccion',
    titulo: 'La dirección',
    cookie: '',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enLaPantallaDeEntrar(u)
      empezar()
      await esperar(700)
      await narrar(0)
      await narrar(1, { mirar: 'text=Entra a tu cartera >> visible=true', escala: 1.7 })
      await reposo(1600)
    },
  },

  {
    id: 'correo_y_clave',
    titulo: 'Tu correo y tu clave',
    cookie: '',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, escribir } = u
      await enLaPantallaDeEntrar(u)
      empezar()
      await narrar(0, {
        mirar: CORREO, escala: 1.8,
        hacer: async () => {
          await escribir(CORREO, CORREO_DEMO)
          await esperar(500)
          await escribir(CLAVE, '••••••••')
          await esperar(700)
        },
      })
      await narrar(1, { mirar: 'button:has-text("Entrar")', escala: 1.9 })
      await reposo(1800)
    },
  },

  {
    id: 'mantener_la_sesion',
    titulo: 'Que no te la vuelva a pedir',
    cookie: '',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await enLaPantallaDeEntrar(u)
      empezar()
      await esperar(600)
      /* ⚠ SOLO SE MIRA, NO SE PULSA. La casilla viene marcada de fábrica
         (`app/login/page.jsx:172`, `useState(true)`), así que pulsarla la
         DESMARCABA en cámara mientras la voz decía «márcala». El vídeo enseñaba
         exactamente lo contrario de lo que hay que hacer. */
      await narrar(0, {
        mirar: 'text=Mantener la sesión en este teléfono >> visible=true', escala: 1.6, fila: true,
      })
      await narrar(1)
      await reposo(1800)
    },
  },

  {
    id: 'la_olvide',
    titulo: 'Si olvidaste la contraseña',
    cookie: '',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocar } = u
      await enLaPantallaDeEntrar(u)
      empezar()
      await narrar(0, {
        mirar: 'text=La olvidé >> visible=true', escala: 2.0, fila: true,
        hacer: async () => {
          await tocar('La olvidé')
          await esperar(2200)
        },
      })
      await narrar(1)
      await reposo(2000)
    },
  },

  {
    id: 'el_icono',
    titulo: 'Para no perderla más',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel, p } = u
      await u.ir('/dashboard', /Buenos|Buenas|Recaudado/i)
      await esperar(1200)
      empezar()
      await narrar(0, {
        mirar: `${MENU} a[href="/mas"]`, escala: 2.2,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/mas"]`)
          await esperar(1600)
          await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
          await esperar(2600)
          await p.locator('button:has-text("Instalar en este dispositivo")').first()
            .scrollIntoViewIfNeeded().catch(() => {})
          await esperar(900)
        },
      })
      await narrar(1, { mirar: 'text=Instalar la app >> visible=true', escala: 1.7 })
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
  nombre: 'volver a entrar',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-22',
  final: '/home/keyce/Desktop/videos-tutoriales/22-volver-a-entrar.mp4',
  tomas: TOMAS,
  cookie,
})
