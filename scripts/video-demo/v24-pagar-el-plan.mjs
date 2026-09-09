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
// ── ⚠ POR QUÉ ESTA VERSIÓN ES DISTINTA ─────────────────────────────────────
//
// La primera la tumbó el dueño: «el vídeo está nefasto, la opción que señala
// nunca aparece en la pantalla. Dice mi plan y nunca sale. Ni siquiera muestra
// la referencia de dónde se mete para llegar a mi plan».
//
// El fallo: los tres clics del camino iban encadenados dentro de UN solo
// `hacer`, así que la cámara pasaba por «Más» y «Configuración» mientras la
// pantalla cargaba y no se veía ninguna opción. **Un paso, una frase, un
// acercamiento y una pausa**: primero se ve la opción, después se toca.
//
// ── LAS DOS VÍAS, QUE ES LO QUE FALTABA ────────────────────────────────────
//
//   RÁPIDA · el botón + de abajo a la derecha → «Mi plan», entra directo.
//   LARGA  · los cuatro cuadritos → Configuración → Plan y pagos → Ver planes.
//
// ⚠ A `/configuracion/plan` NO se entra por su URL: se queda en blanco (7
//   caracteres) y el grabador aborta. Y «Plan y pagos» es la pantalla del
//   DETALLE de la suscripción; donde se paga es la de detrás, por «Ver planes».
//
// ── ⚠ SIN METER MIEDO, Y SIN TOCAR «SUSCRIBIRME» ───────────────────────────
//
// No se nombra el vencimiento ni los días restantes, y la cámara no se para en
// esa tarjeta. Y no se pulsa «Suscribirme»: abre la pasarela y pide una tarjeta
// de verdad.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const MENU = 'nav[aria-label="Navegación principal"]'
const FAB = 'button[aria-label="Crear"]'
const MI_PLAN = 'button:has-text("Mi plan"):visible, a:has-text("Mi plan"):visible'
const AUTO = 'button:has-text("Se cobra solo")'
const MANUAL = 'button:has-text("Pago yo")'

const enElPanel = async (u) => {
  await u.ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await u.esperar(1400)
}

/** La vía rápida: el botón + → «Mi plan». Entra directo a donde se paga. */
const hastaElPlan = async (u) => {
  await enElPanel(u)
  await u.tocarSel(FAB)
  await u.esperar(1800)
  await u.tocarSel(MI_PLAN)
  await u.p.waitForSelector(AUTO, { state: 'visible', timeout: 30000 }).catch(() => {})
  await u.esperar(1200)
}

/* ⚠ `mirar` OCURRE ANTES QUE `hacer` (grabador.mjs:211). O sea: el
   acercamiento subraya lo que YA está en pantalla, y la acción pasa mientras se
   habla. Apuntar a algo que aparece DESPUÉS del clic no funciona: la toma se
   queda esperando seis segundos y aborta. Por eso, cuando hay que subrayar algo
   que vive dentro de un menú, el menú se abre ANTES de `empezar()`. */
const TOMAS = [
  {
    id: 'el_boton_de_mas',
    titulo: 'El botón de más',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await enElPanel(u)
      empezar()
      await narrar(0)
      // Se ve el botón subrayado, y se abre mientras se habla.
      await narrar(1, {
        mirar: FAB, escala: 2.6,
        hacer: async () => {
          await tocarSel(FAB)
          await esperar(2200)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'ahi_esta_mi_plan',
    titulo: 'Ahí está: mi plan',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel, p } = u
      await enElPanel(u)
      // El menú se abre ANTES de grabar: así el acercamiento cae sobre él.
      await tocarSel(FAB)
      await esperar(2000)
      empezar()
      await narrar(0, { mirar: MI_PLAN, escala: 2.0, fila: true })
      await narrar(1, {
        hacer: async () => {
          await tocarSel(MI_PLAN)
          await p.waitForSelector(AUTO, { state: 'visible', timeout: 30000 }).catch(() => {})
          await esperar(1800)
        },
      })
      await reposo(2000)
    },
  },

  {
    id: 'la_otra_forma',
    titulo: 'La otra forma',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel } = u
      await enElPanel(u)
      empezar()
      await narrar(0, {
        mirar: `${MENU} a[href="/mas"]`, escala: 2.4,
        hacer: async () => {
          await tocarSel(`${MENU} a[href="/mas"]`)
          await esperar(2400)
        },
      })
      /* Ahora sí: «Configuración» está en pantalla, se subraya, y el clic pasa
         mientras se habla. */
      await narrar(1, {
        mirar: 'button:has-text("Configuración"):visible, a:has-text("Configuración"):visible', escala: 1.9,
        hacer: async () => {
          await tocarSel('button:has-text("Configuración"):visible, a:has-text("Configuración"):visible')
          await esperar(2800)
          await tocarSel('button:has-text("Plan y pagos"):visible, a:has-text("Plan y pagos"):visible')
          await esperar(2400)
        },
      })
      await reposo(1800)
    },
  },

  {
    id: 'se_cobra_solo',
    titulo: 'Que se cobre solo',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, p } = u
      await hastaElPlan(u)
      /* Se baja hasta «PAGAR MI PLAN» sin pararse en la tarjeta de arriba: ahí
         está lo de «tu plan vence el…», que es lo que no se enseña. */
      await p.locator(AUTO).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1000)
      empezar()
      await narrar(0, { mirar: AUTO, escala: 1.9 })
      await narrar(1, { mirar: 'text=Lo quitas cuando quieras >> visible=true', escala: 1.6, fila: true })
      await reposo(2000)
    },
  },

  {
    id: 'pago_yo',
    titulo: 'O paga usted',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, tocarSel, p } = u
      await hastaElPlan(u)
      await p.locator(MANUAL).first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1000)
      empezar()
      await narrar(0, {
        mirar: MANUAL, escala: 1.9,
        hacer: async () => {
          await tocarSel(MANUAL)
          await esperar(2400)
        },
      })
      // Los periodos ya están en pantalla tras el clic de arriba.
      await narrar(1, { mirar: 'button:has-text("Trimestral"):visible', escala: 1.7, fila: true })
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
      await esperar(1200)
      empezar()
      await narrar(0, { mirar: 'text=Cambiar de plan >> visible=true', escala: 1.6, fila: true })
      await narrar(1, {
        hacer: async () => {
          await p.locator('text=Necesitas ayuda').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(1400)
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
