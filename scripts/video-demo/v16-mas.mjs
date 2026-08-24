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

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde está «Más»',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(1400)
      await decir('El último icono de la barra, el de los cuatro cuadritos', 4.6)
      await esperar(1400)
      await mirar('a[href="/mas"]:visible', { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocarSel('a[href="/mas"]:visible')
      await esperar(3200)
      await decir('Aquí vive todo lo que no cabe abajo. Vamos a verlo entero', 4.8)
      await esperar(5000)
      await reposo(3200)
    },
  },

  {
    id: 'mi_plata',
    titulo: 'Mi plata',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      empezar()
      await decir('Lo primero: mi plata. Es tu capital', 4.0)
      await esperar(1400)
      await mirar('text=Mi plata', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2600)
      await decir('Cuánto tienes listo para prestar y cuánto está en la calle', 5.0)
      await esperar(2000)
      await asomarse(u, 'Mi plata', 5000)
      await decir('Aquí metes plata al negocio o la sacas, y queda anotado', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'caja',
    titulo: 'La caja',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      empezar()
      await decir('Después la caja, que es el día', 3.8)
      await esperar(1400)
      await mirar('text=¿Cómo va el negocio?', { escala: 1.6, ms: 4000, fila: true })
      await esperar(2600)
      await decir('Cuánto entró hoy, cuánto salió y qué te tiene que entregar cada cobrador', 5.6)
      await esperar(2000)
      await asomarse(u, 'Caja', 5200)
      await decir('Es donde se cuadra la noche. La caja no es tu capital: es el día', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },

  {
    id: 'simulador_reportes',
    titulo: 'Simulador y reportes',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      empezar()
      await decir('El simulador es para responder antes de prestar', 4.4)
      await esperar(1400)
      await mirar('text=Cuánto quedaría de cuota', { escala: 1.6, ms: 4000, fila: true })
      await esperar(2600)
      await decir('Le metes el monto y te dice de cuánto le quedaría la cuota', 5.0)
      await esperar(5200)
      await mirar('text=Reportes', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2400)
      await decir('Y los reportes, para bajarte los números del negocio', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },

  {
    id: 'gastos_cobradores',
    titulo: 'Gastos y cobradores',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      empezar()
      await decir('Gastos: la gasolina, los almuerzos, lo que se va del negocio', 5.0)
      await esperar(1600)
      await mirar('text=Gastos', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2800)
      await decir('Sin anotarlos, la ganancia que te enseña el sistema está inflada', 5.2)
      await esperar(5400)
      await mirar('text=Cobradores', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2400)
      await decir('Y cobradores: tu gente, con lo que lleva recaudado cada uno', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'perdidos_socios',
    titulo: 'Perdidos, socios y quién hizo qué',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=Perdidos')
      empezar()
      await decir('Perdidos: los que ya diste por perdidos, apartados', 4.6)
      await esperar(1600)
      await mirar('text=Perdidos', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2800)
      await decir('Socios, si el capital no es todo tuyo, para saber de quién es cada parte', 5.6)
      await esperar(1800)
      await mirar('text=Quién hizo qué', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2600)
      await decir('Y quién hizo qué: cada movimiento, con nombre y hora', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },

  {
    id: 'cargar',
    titulo: 'Cargar lo que ya tienes',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=CARGAR DATOS')
      empezar()
      await decir('Si vienes de un cuaderno o de un Excel, esto es para ti', 5.0)
      await esperar(1600)
      await mirar('text=Le tomas foto y se pasa solo', { escala: 1.6, ms: 4200, fila: true })
      await esperar(2800)
      await decir('Le tomas foto a la hoja del cuaderno y se pasa solo', 4.8)
      await esperar(5000)
      await mirar('text=Importar Excel', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2400)
      await decir('O subes el Excel, si ya lo llevabas en el computador', 4.6)
      await esperar(4800)
      await reposo(3400)
    },
  },

  {
    id: 'cuenta',
    titulo: 'Configuración, soporte y tutoriales',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaMas(u)
      await bajarHasta(u, 'text=CUENTA')
      empezar()
      await decir('Y abajo del todo, tres cosas', 4.0)
      await esperar(1400)
      await mirar('text=Configuración', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2600)
      await decir('Configuración, que es cómo trabaja el sistema contigo. Tiene su vídeo', 5.6)
      await esperar(5800)
      await mirar('text=Tutoriales', { escala: 1.7, ms: 4000, fila: true })
      await esperar(2400)
      await decir('Soporte, para escribirnos. Y tutoriales, que es donde estás ahora', 5.2)
      await esperar(5400)
      await reposo(3400)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { esperar, empezar, decir, reposo } = u
      await hastaMas(u)
      empezar()
      await esperar(2000)
      await decir('Eso es todo lo que hay detrás de esos cuatro cuadritos', 4.8)
      await esperar(5000)
      await decir('No hace falta aprendérselo: con saber que está aquí, basta', 5.0)
      await esperar(5200)
      await reposo(4000)
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
