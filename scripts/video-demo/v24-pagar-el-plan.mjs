// scripts/video-demo/v24-pagar-el-plan.mjs
//
// VÍDEO 24 · Cómo pagar el plan
//
//     node scripts/video-demo/voz.mjs 24-pagar-el-plan --solo-audio      # 1 · audio
//     SIN_ROTULOS=1 LOCUCION=24-pagar-el-plan \
//       node scripts/video-demo/v24-pagar-el-plan.mjs                    # 2 · grabar
//     node scripts/video-demo/voz.mjs 24-pagar-el-plan                   # 3 · voz
//     node scripts/video-demo/subtitulos.mjs 24-pagar-el-plan --quemar   # 4 · subtitulos
//
// ⚠ `SIN_ROTULOS=1` NO ES OPCIONAL: sin él el rótulo se quema en la imagen y
//   luego el subtítulo va encima, con el mismo texto dos veces.
//
// ── POR QUÉ EXISTE ─────────────────────────────────────────────────────────
//
// «Pagar o renovar» es el 23 % de lo que preguntan los clientes registrados —34
// de 204 preguntas medidas el 2 sep 2026, de 27 personas— y no había vídeo:
//
//     «Quiero pagar el sistema como hago?»   ·   «A dónde pago»
//
// ── ⚠ Y SIN METER MIEDO ────────────────────────────────────────────────────
//
// Lo pidió el dueño con esas palabras. Quien ve esto ya es cliente y está
// buscando cómo pagarle: no hay que empujarlo, hay que quitarle la duda. Así
// que el vídeo NO se para en la tarjeta de «tu plan vence el…» ni nombra días
// restantes, y sí dice lo que tranquiliza: que el cobro automático se quita
// cuando uno quiera y que hay una persona al otro lado.
//
// ── ⚠ NO SE TOCA «SUSCRIBIRME» ─────────────────────────────────────────────
//
// Ese botón abre la pasarela de pago, que pide datos de tarjeta reales. El
// vídeo llega hasta él y para: ahí el cliente ya sabe qué hacer.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const MENU = 'nav[aria-label="Navegación principal"]'
const AUTO = 'button:has-text("Se cobra solo")'
const MANUAL = 'button:has-text("Pago yo")'

/** Panel → «Más» → Configuración → «Plan y pagos».
 *
 * ⚠ POR EL MENÚ, NO POR LA URL. Entrando directo a `/configuracion/plan` la
 * pantalla se queda en blanco (7 caracteres) y el grabador aborta: monta sobre
 * el estado de configuración, que no existe si se llega de cero. Además es el
 * camino que hace el cliente, que es lo que el vídeo tiene que enseñar. */
const hastaElPlan = async (u) => {
  await u.ir('/configuracion', /Configuraci[oó]n|Tu negocio/i)
  await u.esperar(1800)
  await u.tocarSel('button:has-text("Plan y pagos"):visible, a:has-text("Plan y pagos"):visible')
  await u.esperar(2400)
  /* ⚠ SON DOS PANTALLAS. «Plan y pagos» enseña el DETALLE de la suscripción
     —qué plan tiene, cuándo renueva, el historial—; donde se paga es la de
     detrás, a la que se entra por «Ver planes». Yo apuntaba a la primera y la
     toma se quedaba esperando un botón que allí no existe. */
  await u.tocarSel('button:has-text("Ver planes"):visible, a:has-text("Ver planes"):visible')
  /* Pide los datos de la suscripción al entrar: se espera al botón, no al reloj. */
  await u.p.waitForSelector(AUTO, { state: 'visible', timeout: 30000 }).catch(() => {})
  await u.esperar(1200)
}

const TOMAS = [
  {
    id: 'donde_se_paga',
    titulo: 'Dónde se paga',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await u.ir('/dashboard', /Buenos|Buenas|Recaudado/i)
      await esperar(1200)
      empezar()
      await narrar(0)
      await narrar(1, {
        mirar: `${MENU} a[href="/mas"]`, escala: 2.2,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/mas"]`)
          await esperar(1600)
          await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
          await esperar(2600)
          await tocarSel('button:has-text("Plan y pagos"):visible, a:has-text("Plan y pagos"):visible')
          await esperar(2600)
          await tocarSel('button:has-text("Ver planes"):visible, a:has-text("Ver planes"):visible')
          await esperar(2800)
        },
      })
      await reposo(1800)
    },
  },

  {
    id: 'se_cobra_solo',
    titulo: 'Dos formas, usted elige',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, p } = u
      await hastaElPlan(u)
      /* ⚠ Se baja hasta «PAGAR MI PLAN» sin pararse en la tarjeta de arriba:
         ahí está lo de «tu plan vence el…», que es justo lo que no se enseña. */
      await p.locator(AUTO).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(900)
      empezar()
      await narrar(0, { mirar: AUTO, escala: 1.8 })
      await narrar(1, { mirar: 'text=Lo quitas cuando quieras >> visible=true', escala: 1.6, fila: true })
      await reposo(2000)
    },
  },

  {
    id: 'pago_yo',
    titulo: 'O paga usted, cuando quiera',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel, p } = u
      await hastaElPlan(u)
      await p.locator(MANUAL).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(900)
      empezar()
      await narrar(0, {
        mirar: MANUAL, escala: 1.8,
        hacer: async () => {
          await tocarSel(MANUAL)
          await esperar(2400)
        },
      })
      await narrar(1)
      await reposo(2000)
    },
  },

  {
    id: 'cada_cuanto',
    titulo: 'Mensual, trimestral o anual',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel, p } = u
      await hastaElPlan(u)
      await p.locator(MANUAL).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(700)
      await tocarSel(MANUAL)
      await esperar(2000)
      empezar()
      await narrar(0, { mirar: 'button:has-text("Trimestral"):visible', escala: 1.7, fila: true })
      await narrar(1, { mirar: 'button:has-text("Anual"):visible', escala: 1.7, fila: true })
      await reposo(2200)
    },
  },

  {
    id: 'cambiar_y_ayuda',
    titulo: 'Cambiar de plan, y ayuda',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, p } = u
      await hastaElPlan(u)
      await p.locator('text=Cambiar de plan').first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1000)
      empezar()
      await narrar(0, { mirar: 'text=Cambiar de plan >> visible=true', escala: 1.6, fila: true })
      await narrar(1, {
        hacer: async () => {
          await p.locator('text=Necesitas ayuda').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(1200)
        },
        mirar: 'text=Necesitas ayuda >> visible=true', escala: 1.6, fila: true,
      })
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
  nombre: 'pagar el plan',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-24',
  final: '/home/keyce/Desktop/videos-tutoriales/24-pagar-el-plan.mp4',
  tomas: TOMAS,
  cookie,
})
