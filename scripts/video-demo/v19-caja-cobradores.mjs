// scripts/video-demo/v19-caja-cobradores.mjs
//
// VÍDEO 19 · La caja cuando tienes cobradores
//
//     node scripts/video-demo/voz.mjs 19-caja-cobradores --solo-audio
//     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=19-caja-cobradores \
//       node scripts/video-demo/v19-caja-cobradores.mjs
//
// El tercero de los que salieron del vídeo de caja. Da por visto el 18 —cómo se
// arma el saldo— y cuenta SOLO LO QUE CAMBIA al tener gente cobrando:
//
//   · la pestaña «Cuadre», que solo existe con cobradores (`caja/page.jsx:1537`)
//   · quién ya entregó y quién no
//   · la caja de cada uno, para compararla con la tuya
//
// ── LA TOMA QUE SOSTIENE EL VÍDEO ──────────────────────────────────────────
//
// La 7, «las dos tienen que decir lo mismo». Son palabras del dueño y es la
// regla que gobierna todo el módulo:
//
//   «Si haces un ajuste que dañe también la caja del cobrador, ahí se jodió
//    todo porque ningún número va a corresponder.»
//
// ⚠ TODOS LOS `text=` LLEVAN `>> visible=true`. Esta pantalla pinta el árbol de
//   móvil y el de escritorio a la vez, y `text=` no admite `:visible` —es otro
//   motor de selección—, así que `.first()` coge la copia escondida y la toma se
//   queda esperando a un nodo con `display:none`.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO, BASE } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'
import { borrarElDia, montarElDia, cobradorActivo } from './decorado-caja.mjs'

const galleta = (rol) => encode({
  token: {
    sub: rol === 'owner' ? IDS.owner : IDS.cobrador,
    id: rol === 'owner' ? IDS.owner : IDS.cobrador,
    email: 'demo@ejemplo.com',
    name: rol === 'owner' ? 'Sofía Restrepo' : 'Andrés Vargas',
    rol, organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: rol === 'owner' ? [] : [IDS.ruta],
  },
  secret: SECRETO,
})

/* Aquí el día lo cobra EL COBRADOR: es lo que hace que aparezca «Cuadre» y que
   el dueño tenga a quién esperar. Es el mismo día del vídeo 11 y del 18 —los
   mismos $92.600 y los mismos $450.000— visto desde el tercer sitio. */
const limpiar = async () => {
  await cobradorActivo(true)
  await borrarElDia()
  await montarElDia(BASE, await galleta('cobrador'))
}

/** La caja del dueño vive en «Más». */
const hastaCaja = async (u) => {
  await u.ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await u.esperar(1200)
  await u.tocarSel('a[href="/mas"]:visible')
  await u.esperar(2400)
  await u.tocarSel('button:has-text("Caja"):visible, a:has-text("Caja"):visible')
  await u.esperar(4200)
}

const enCuadre = async (u) => {
  await hastaCaja(u)
  await u.tocar('Cuadre')
  await u.esperar(3000)
}

const bajarHasta = async (u, sel) => {
  await u.p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(1200)
}

const TOMAS = [
  {
    id: 'lo_que_cambia',
    titulo: 'Lo que cambia con cobradores',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=CÓMO SE ARMA EL SALDO >> visible=true', escala: 1.6 })
      await reposo(1400)
    },
  },

  {
    id: 'con_nombre',
    titulo: 'Cada cobro con su nombre',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo, p } = u
      await hastaCaja(u)
      await bajarHasta(u, 'text=MOVIMIENTOS DE HOY')
      empezar()
      await narrar(0, { mirar: 'text=Cobro · >> visible=true', escala: 1.5, fila: true })
      await narrar(1, {
        hacer: async () => {
          await p.mouse.wheel(0, 220); await esperar(600)
          await mirar('text=Andrés Vargas >> visible=true', { escala: 1.6, ms: 2400, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'cuarta_pestana',
    titulo: 'La cuarta pestaña',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Cuadre"):visible', escala: 1.9,
        hacer: async () => { await tocar('Cuadre'); await esperar(2400) },
      })
      await narrar(1)
      await reposo(1600)
    },
  },

  {
    id: 'quien_entrego',
    titulo: 'Quién ya entregó',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await enCuadre(u)
      empezar()
      await narrar(0, { mirar: 'text=Andrés Vargas >> visible=true', escala: 1.5, fila: true })
      await narrar(1)
      await narrar(2)
      await reposo(1600)
    },
  },

  {
    id: 'no_cuadra',
    titulo: 'Cuando la cuenta no cuadra',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo } = u
      await enCuadre(u)
      empezar()
      await narrar(0)
      await narrar(1, {
        hacer: async () => {
          await mirar('text=Andrés Vargas >> visible=true', { escala: 1.4, ms: 2600, fila: true })
          await esperar(300)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'caja_de_cada_uno',
    titulo: 'La caja de cada uno',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      await tocar('Por ruta')
      await esperar(2600)
      empezar()
      await narrar(0, { mirar: 'text=Caja por cobrador >> visible=true', escala: 1.7 })
      await narrar(1, {
        hacer: async () => {
          await u.p.selectOption('select:visible', { label: 'Andrés Vargas' }).catch(() => {})
          await esperar(3000)
        },
      })
      await reposo(1800)
    },
  },

  {
    id: 'lo_mismo',
    titulo: 'Las dos tienen que decir lo mismo',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo } = u
      await hastaCaja(u)
      await u.tocar('Por ruta')
      await esperar(2600)
      await u.p.selectOption('select:visible', { label: 'Andrés Vargas' }).catch(() => {})
      await esperar(3400)
      empezar()
      await narrar(0)
      /* La cifra que comparten las dos pantallas. `fila: true` obligatorio: el
         rótulo va a la izquierda y el número a la derecha, y sin ensanchar el
         encuadre sale el rótulo sin cifra. */
      await narrar(1, {
        hacer: async () => {
          await mirar('text=Lo que cobró >> visible=true', { escala: 1.6, ms: 2600, fila: true })
          await esperar(300)
        },
      })
      await narrar(2)
      await reposo(1800)
    },
  },

  {
    id: 'por_ruta',
    titulo: 'Por ruta',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Por ruta"):visible', escala: 1.8,
        hacer: async () => { await tocar('Por ruta'); await esperar(2600) },
      })
      await narrar(1, { mirar: 'text=Efectivo >> visible=true', escala: 1.6, fila: true })
      await reposo(1600)
    },
  },

  {
    id: 'cierre',
    titulo: 'Dónde te deja',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Cuentas"):visible', escala: 1.8,
        hacer: async () => { await tocar('Cuentas'); await esperar(2800) },
      })
      await narrar(1)
      await reposo(2200)
    },
  },
]

const cookie = await galleta('owner')

await correr({
  nombre: 'caja con cobradores',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-19',
  final: '/home/keyce/Desktop/videos-tutoriales/19-caja-cobradores.mp4',
  tomas: TOMAS,
  cookie,
  antesDeToma: limpiar,
})
