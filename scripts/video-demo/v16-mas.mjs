// scripts/video-demo/v16-mas.mjs
//
// VÍDEO 16 · Todo lo que hay en «Más»
//
//     node scripts/video-demo/v16-mas.mjs
//     node scripts/video-demo/v16-mas.mjs --toma 5
//
// Palabras del dueño: «decir qué pueden encontrar. Por ejemplo, la caja y un
// poquito para qué sirve; que pueden encontrar los reportes, el capital y demás.
// Describir todas las opciones rápidamente para que sepan dónde encontrarlas y
// qué pueden hacer dentro. No entramos a tocar dentro de cada configuración
// porque sería un vídeo muy extenso.»
//
// Así que este vídeo es un ÍNDICE. Nombra las trece cosas que hay ahí, dice para
// qué sirve cada una en una frase, y entra en tres —Mi plata, Caja y Reportes—
// solo para que se vea qué pinta tienen.
//
// ── POR QUÉ HACE FALTA ─────────────────────────────────────────────────────
//
// «Más» es donde vive todo lo que no cabe en la barra de abajo: el capital, la
// caja del dueño, los reportes, los gastos, los cobradores, los socios, el
// registro de quién hizo qué, las dos formas de cargar datos y la configuración
// entera. Trece entradas detrás de un icono de cuatro cuadritos, y nada en la
// pantalla dice que están ahí.
//
// ⚠ NO SE ENTRA EN CONFIGURACIÓN: son ocho apartados y tienen su propio vídeo,
//   el 10. Aquí solo se dice dónde está y qué hay dentro.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** «Más», por el último icono de la barra, que es por donde se llega. */
const hastaMas = async (u) => {
  await enElPanel(u)
  await u.tocarSel('a[href="/mas"]:visible')
  await u.esperar(3000)
}

/** Entra en una de las entradas y vuelve, para enseñar qué pinta tiene. */
const asomarse = async (u, texto, ms = 4200) => {
  await u.tocarSel(`button:has-text("${texto}"):visible, a:has-text("${texto}"):visible`)
  await u.esperar(ms)
}

const bajarHasta = async (u, sel) => {
  await u.p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(1400)
}

/* El ritmo lo pone la voz: `narrar(i)` dura lo que dura su frase y la pantalla
   se mueve DENTRO de ella. Ver la nota larga de `grabador.mjs`.

     node scripts/video-demo/voz.mjs 16-mas --solo-audio
     SIN_ROTULOS=1 LOCUCION=16-mas node scripts/video-demo/v16-mas.mjs */
const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde está «Más»',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0, {
        mirar: 'a[href="/mas"]:visible', escala: 2.4,
        hacer: async () => { await tocarSel('a[href="/mas"]:visible'); await esperar(1800) },
      })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'mi_plata',
    titulo: 'Mi plata',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await hastaMas(u)
      empezar()
      await narrar(0, { mirar: 'text=Mi plata', escala: 1.7, fila: true })
      await narrar(1, { hacer: async () => { await asomarse(u, 'Mi plata', 2600) } })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'caja',
    titulo: 'La caja',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo } = u
      await hastaMas(u)
      empezar()
      await narrar(0, { mirar: 'text=¿Cómo va el negocio?', escala: 1.6, fila: true })
      await narrar(1, { hacer: async () => { await asomarse(u, 'Caja', 2800) } })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'simulador_reportes',
    titulo: 'Simulador y reportes',
    async grabar(u) {
      const { empezar, narrar, mirar, reposo } = u
      await hastaMas(u)
      empezar()
      await narrar(0, { mirar: 'text=Cuánto quedaría de cuota', escala: 1.6, fila: true })
      await narrar(1)
      await narrar(2, { mirar: 'text=Reportes', escala: 1.7, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'gastos_cobradores',
    titulo: 'Gastos y cobradores',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaMas(u)
      empezar()
      await narrar(0, { mirar: 'text=Gastos', escala: 1.7, fila: true })
      await narrar(1)
      await narrar(2, { mirar: 'text=Cobradores', escala: 1.7, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'perdidos_socios',
    titulo: 'Perdidos, socios y quién hizo qué',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=Perdidos')
      empezar()
      await narrar(0, { mirar: 'text=Perdidos', escala: 1.7, fila: true })
      await narrar(1, {
        hacer: async () => {
          await mirar('text=Socios', { escala: 1.7, ms: 2400, fila: true })
          await esperar(300)
        },
      })
      await narrar(2, { mirar: 'text=Quién hizo qué', escala: 1.7, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'cargar',
    titulo: 'Cargar lo que ya tienes',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=CARGAR DATOS')
      empezar()
      await narrar(0, { mirar: 'text=CARGAR DATOS', escala: 1.6 })
      await narrar(1, { mirar: 'text=Le tomas foto y se pasa solo', escala: 1.6, fila: true })
      await narrar(2, { mirar: 'text=Importar Excel', escala: 1.7, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'cuenta',
    titulo: 'Configuración, soporte y tutoriales',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=CUENTA')
      empezar()
      await narrar(0, { mirar: 'text=CUENTA', escala: 1.6 })
      await narrar(1, { mirar: 'text=Configuración', escala: 1.7, fila: true })
      await narrar(2, { mirar: 'text=Tutoriales', escala: 1.7, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { esperar, empezar, narrar, reposo, p } = u
      await hastaMas(u)
      empezar()
      await esperar(600)
      /* Se sube la pantalla despacio mientras se cierra: repasar la lista entera
         dice «esto es todo lo que hay» mejor que el rótulo solo. */
      await narrar(0, {
        hacer: async () => { await p.mouse.wheel(0, 300); await esperar(700) },
      })
      await narrar(1, {
        hacer: async () => { await p.mouse.wheel(0, -300); await esperar(700) },
      })
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
  nombre: 'más',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-16',
  final: '/home/keyce/Desktop/videos-tutoriales/16-mas.mp4',
  tomas: TOMAS,
  cookie,
})
