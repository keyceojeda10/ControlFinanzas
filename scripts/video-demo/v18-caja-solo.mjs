// scripts/video-demo/v18-caja-solo.mjs
//
// VÍDEO 18 · La caja si cobras tú solo
//
//     node scripts/video-demo/voz.mjs 18-caja-solo --solo-audio
//     BASE_VIDEO=http://localhost:3105 SIN_ROTULOS=1 LOCUCION=18-caja-solo \
//       node scripts/video-demo/v18-caja-solo.mjs
//
// Uno de los tres en que se partió el vídeo de caja:
//
//   · 11 · La caja del cobrador
//   · 18 · La caja si cobras tú solo    ← este
//   · 19 · La caja con cobradores
//
// El dueño: «ahí está la caja del administrador solo, sin cobradores, y está la
// caja del administrador con cobradores, y en el vídeo se revolvieron todos.
// Era una locura, no se entendía nada.»
//
// ── ⚠ ESTE VÍDEO APAGA AL COBRADOR DE LA DEMO ──────────────────────────────
//
// La pantalla que explica **solo existe sin cobradores**: «Cuadre» aparece con
// `cobradoresParaFiltro.length > 0` (`caja/page.jsx:1537`) y «Mi cierre del
// día» sale cuando no hay ninguno (`:1972`). Grabarlo con el cobrador activo
// sería enseñar otra pantalla y volver a mezclarlo todo.
//
// Y no basta con apagarlo: el API lista también a los inactivos que tuvieron
// movimiento ese día (`api/caja/route.js:1097`), así que **el día lo cobra el
// dueño**. Se enciende otra vez al terminar; si la grabación se corta a mitad,
// hay que encenderlo a mano o los vídeos 8, 11 y 19 salen mal.

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

/* El día, montado por el DUEÑO: los cobros tienen que ser suyos o el cobrador
   apagado reaparecería en la lista por haber tenido movimiento. */
const limpiar = async () => {
  await cobradorActivo(false)
  await borrarElDia()
  await montarElDia(BASE, await galleta('owner'))
}

/** La caja del dueño vive en «Más», no en la barra de abajo. */
const hastaCaja = async (u) => {
  await u.ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await u.esperar(1200)
  await u.tocarSel('a[href="/mas"]:visible')
  await u.esperar(2400)
  await u.tocarSel('button:has-text("Caja"):visible, a:has-text("Caja"):visible')
  await u.esperar(4200)
}

const bajarHasta = async (u, sel) => {
  await u.p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(1200)
}

/* ⚠ TODOS LOS `text=` LLEVAN `>> visible=true`.
   Esta pantalla pinta el árbol de móvil y el de escritorio a la vez, y `text=`
   no admite `:visible` —es otro motor de selección—, así que `.first()` cogía
   la copia escondida y la toma se quedaba seis segundos esperando a que un
   nodo con `display:none` se dejara ver. Pasó con «Con lo que amaneciste», que
   está en pantalla y en el DOM dos veces. */
const TOMAS = [
  {
    id: 'como_llegar',
    titulo: 'Cómo llegar a tu caja',
    async grabar(u) {
      const { ir, esperar, empezar, narrar, tocarSel, reposo } = u
      await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
      await esperar(1200)
      empezar()
      await esperar(700)
      await narrar(0, {
        mirar: 'a[href="/mas"]:visible', escala: 2.4,
        hacer: async () => { await tocarSel('a[href="/mas"]:visible'); await esperar(1800) },
      })
      await narrar(1, {
        hacer: async () => {
          await tocarSel('button:has-text("Caja"):visible, a:has-text("Caja"):visible')
          await esperar(3000)
        },
      })
      await reposo(1600)
    },
  },

  {
    id: 'es_la_tuya',
    titulo: 'Esta caja es la tuya',
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
    id: 'como_se_arma',
    titulo: 'Cómo se arma el saldo',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, { mirar: 'text=Con lo que amaneciste >> visible=true', escala: 1.7, fila: true })
      await narrar(1)
      /* ⚠ `fila: true` SIEMPRE en «SALDO EN CAJA»: es un rótulo pegado al margen
         y sin ensanchar el encuadre la cifra se va fuera por la derecha. Es la
         queja de siempre del dueño, «se corta, se desencuadra». */
      await narrar(2, { mirar: 'text=disponible para prestar >> visible=true', escala: 1.7, fila: true })
      await reposo(1600)
    },
  },

  {
    id: 'se_abre',
    titulo: 'Cada renglón se abre',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, { mirar: 'text=Lo que prestaste >> visible=true', escala: 1.7, fila: true })
      await narrar(1, {
        hacer: async () => { await tocar('Lo que prestaste'); await esperar(2400) },
      })
      await reposo(1600)
    },
  },

  {
    id: 'movimientos',
    titulo: 'Los movimientos del día',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo, p } = u
      await hastaCaja(u)
      await bajarHasta(u, 'text=MOVIMIENTOS DE HOY')
      empezar()
      await narrar(0, { mirar: 'text=MOVIMIENTOS DE HOY >> visible=true', escala: 1.6 })
      await narrar(1, {
        hacer: async () => {
          await p.mouse.wheel(0, 240); await esperar(600)
          await mirar('text=Cobro · >> visible=true', { escala: 1.5, ms: 2400, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'gasto',
    titulo: 'Anotar un gasto',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Registrar gasto"):visible', escala: 1.8,
        hacer: async () => { await tocar('Registrar gasto'); await esperar(2400) },
      })
      await narrar(1)
      await reposo(1600)
    },
  },

  {
    id: 'mi_cierre',
    titulo: 'Mi cierre del día',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaCaja(u)
      await bajarHasta(u, 'text=Mi cierre del día')
      empezar()
      await narrar(0, { mirar: 'text=Mi cierre del día >> visible=true', escala: 1.7 })
      await narrar(1)
      await narrar(2)
      await reposo(1800)
    },
  },

  {
    id: 'pestanas',
    titulo: 'Las pestañas que tienes',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaCaja(u)
      empezar()
      await narrar(0, { mirar: 'button:has-text("Caja del día"):visible', escala: 1.7, fila: true })
      await narrar(1, {
        hacer: async () => {
          await tocar('Por ruta'); await esperar(2000)
          await tocar('Cuentas'); await esperar(2000)
        },
      })
      await narrar(2)
      await reposo(2000)
    },
  },
]

const cookie = await galleta('owner')

try {
  await correr({
    nombre: 'caja del dueño solo',
    dir: '/home/keyce/Desktop/videos-tutoriales/tomas-18',
    final: '/home/keyce/Desktop/videos-tutoriales/18-caja-solo.mp4',
    tomas: TOMAS,
    cookie,
    antesDeToma: limpiar,
  })
} finally {
  /* ⚠ PASE LO QUE PASE, EL COBRADOR VUELVE. Si esto se salta —una toma que
     revienta, un Ctrl+C— la demo se queda sin cobrador y el fallo aparece en la
     SIGUIENTE grabación, no en esta. Por eso va en un `finally` y no al final. */
  await cobradorActivo(true)
  console.log('· cobrador de la demo encendido otra vez')
}
