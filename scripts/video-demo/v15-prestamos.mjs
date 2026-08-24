// scripts/video-demo/v15-prestamos.mjs
//
// VÍDEO 15 · La pantalla de préstamos, y un préstamo por dentro
//
//     node scripts/video-demo/v15-prestamos.mjs
//     node scripts/video-demo/v15-prestamos.mjs --toma 8
//
// El hermano del 14, con los préstamos. Palabras del dueño: «a grosso modo
// también, los filtros, qué se puede gestionar desde la pantalla de préstamos y
// qué se puede gestionar dentro de un préstamo. Señalando las opciones, dónde
// pueden encontrar cada cosa, sin entrar tanto a detalle, para que cuando entren
// puedan investigar.»
//
// Un mapa, no un manual. Cada cosa que se nombra tiene su vídeo aparte o su
// guía en el buscador.
//
// ── LO QUE ESTE VÍDEO EXISTE PARA ENSEÑAR ──────────────────────────────────
//
// La hoja de «Gestión». Ahí dentro está TODO lo que se le puede hacer a un
// préstamo —recargo, descuento, plazo, próximo cobro, días sin cobro, editar,
// renovar, cerrar anticipado, mover a perdidos, cancelar y eliminar— y no hay
// forma de adivinar que existe: es un botón de tres letras al lado de dos más.
//
// ⚠ NADA SE PULSA DENTRO DE ESA HOJA. Se abre, se enseña y se cierra: son once
//   acciones y diez de ellas mueven plata o cierran el préstamo.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const CLIENTE = 'Marta Elena Ospina'

const enElPanel = async ({ ir, esperar }) => {
  await ir('/dashboard', /Buenos|Buenas|Recaudado/i)
  await esperar(1200)
}

/** La lista, por la pestaña de la barra, que es por donde se llega. */
const hastaPrestamos = async (u) => {
  await enElPanel(u)
  await u.tocarSel('a[href="/prestamos"]:visible')
  await u.esperar(3200)
}

/** Y de ahí, dentro del préstamo que tiene movimiento. */
const hastaElPrestamo = async (u) => {
  await hastaPrestamos(u)
  await u.tocar(CLIENTE)
  await u.esperar(4000)
}

const bajarHasta = async (u, sel) => {
  await u.p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {})
  await u.esperar(1400)
}

/* El ritmo lo pone la voz: `narrar(i)` dura lo que dura su frase y la pantalla
   se mueve DENTRO de ella. Ver la nota larga de `grabador.mjs`.

     node scripts/video-demo/voz.mjs 15-prestamos --solo-audio
     SIN_ROTULOS=1 LOCUCION=15-prestamos node scripts/video-demo/v15-prestamos.mjs */
const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde están tus préstamos',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(700)
      await narrar(0, {
        mirar: 'a[href="/prestamos"]:visible', escala: 2.4,
        hacer: async () => { await tocarSel('a[href="/prestamos"]:visible'); await esperar(2000) },
      })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'las_tres_cifras',
    titulo: 'Las tres cifras de arriba',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0, { mirar: 'text=EN LA CALLE', escala: 1.6, fila: true })
      await narrar(1, {
        hacer: async () => {
          await mirar('text=EN MORA', { escala: 1.6, ms: 2200, fila: true })
          await esperar(300)
          await mirar('text=COBRADO MES', { escala: 1.6, ms: 2200, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'cada_uno',
    titulo: 'Lo que dice cada préstamo',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo, p } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0)
      await narrar(1, { mirar: 'text=Wilmer Andrés Salas', escala: 1.4, fila: true })
      await narrar(2, {
        hacer: async () => {
          await p.mouse.wheel(0, 240); await esperar(500)
          await mirar('text=Diario 20% Clásico', { escala: 1.5, ms: 2600, fila: true })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'filtros',
    titulo: 'Los filtros, que son muchos',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0, { mirar: 'button:has-text("En mora"):visible', escala: 1.7 })
      await narrar(1, {
        hacer: async () => {
          await tocar('En mora'); await esperar(1500)
          await tocar('Completados'); await esperar(1500)
        },
      })
      await narrar(2, {
        hacer: async () => {
          await tocar('Hoy'); await esperar(1400)
          await tocar('En 5 días'); await esperar(1600)
        },
      })
      await narrar(3, { hacer: async () => { await tocar('Todos'); await esperar(1200) } })
      await reposo(1400)
    },
  },

  {
    id: 'renovar_perdidos',
    titulo: 'Dos filtros que valen plata',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0)
      await narrar(1, {
        mirar: 'button:has-text("Renovar"):visible', escala: 1.8,
        hacer: async () => { await tocar('Renovar'); await esperar(1600) },
      })
      await narrar(2, {
        mirar: 'button:has-text("Perdidos"):visible', escala: 1.8,
        hacer: async () => { await tocar('Perdidos'); await esperar(1600) },
      })
      await reposo(1400)
    },
  },

  {
    id: 'buscador',
    titulo: 'Buscar un préstamo',
    async grabar(u) {
      const CAMPO = 'input[placeholder="Nombre o cédula"]:visible'
      const { esperar, empezar, narrar, escribir, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0, {
        mirar: CAMPO, escala: 1.8,
        hacer: async () => { await escribir(CAMPO, 'Marta'); await esperar(1600) },
      })
      await narrar(1)
      await reposo(1400)
    },
  },

  {
    id: 'abrir',
    titulo: 'Un préstamo por dentro',
    async grabar(u) {
      const { esperar, empezar, narrar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await narrar(0, { hacer: async () => { await tocar(CLIENTE); await esperar(3000) } })
      await narrar(1, { mirar: 'text=REGISTRAR PAGO DIARIO', escala: 1.6, fila: true })
      await reposo(1400)
    },
  },

  {
    id: 'cuanto_debe',
    titulo: 'Cuánto falta, y cuánto si cancela hoy',
    async grabar(u) {
      const { empezar, narrar, reposo } = u
      await hastaElPrestamo(u)
      empezar()
      await narrar(0, { mirar: 'text=LE FALTA PAGAR', escala: 1.6, fila: true })
      await narrar(1, { mirar: 'text=Si lo cancela hoy', escala: 1.6, fila: true })
      await narrar(2)
      await reposo(1400)
    },
  },

  {
    id: 'como_se_pacto',
    titulo: 'Cómo se pactó y qué ha pagado',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, reposo, p } = u
      await hastaElPrestamo(u)
      await bajarHasta(u, 'text=CÓMO SE PACTÓ')
      empezar()
      await narrar(0, { mirar: 'text=CÓMO SE PACTÓ', escala: 1.6 })
      await narrar(1)
      await narrar(2, {
        hacer: async () => {
          await p.locator('text=CADA PAGO QUE HA HECHO').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(600)
          await mirar('text=CADA PAGO QUE HA HECHO', { escala: 1.6, ms: 2600 })
        },
      })
      await reposo(1400)
    },
  },

  {
    id: 'gestion',
    titulo: 'La hoja de Gestión, que es la clave',
    async grabar(u) {
      const { esperar, empezar, narrar, tocarSel, reposo } = u
      await hastaElPrestamo(u)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Gestión"):visible', escala: 2.2,
        hacer: async () => { await tocarSel('button:has-text("Gestión"):visible'); await esperar(2200) },
      })
      await narrar(1)
      await narrar(2, { mirar: 'text=CAMBIA LO QUE SE COBRA', escala: 1.5 })
      await reposo(1600)
    },
  },

  {
    id: 'gestion_dos',
    titulo: 'Y el resto de la hoja',
    async grabar(u) {
      const { esperar, empezar, narrar, mirar, tocarSel, reposo, p } = u
      await hastaElPrestamo(u)
      await tocarSel('button:has-text("Gestión"):visible')
      await esperar(2200)
      empezar()
      await narrar(0, { mirar: 'text=CAMBIA CUÁNDO SE COBRA', escala: 1.5 })
      await narrar(1, {
        hacer: async () => {
          await p.locator('text=CIERRA EL PRÉSTAMO').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(600)
          await mirar('text=CIERRA EL PRÉSTAMO', { escala: 1.5, ms: 2600 })
        },
      })
      await narrar(2, {
        hacer: async () => {
          await mirar('text=Renovar el préstamo', { escala: 1.5, ms: 2200, fila: true })
          await esperar(300)
          await mirar('text=Mover a perdidos', { escala: 1.5, ms: 2200, fila: true })
        },
      })
      await narrar(3, {
        hacer: async () => {
          await mirar('text=Eliminar el préstamo', { escala: 1.5, ms: 2400, fila: true })
        },
      })
      await reposo(1800)
    },
  },

  {
    id: 'cierre',
    titulo: 'El pagaré y el comprobante',
    async grabar(u) {
      const { empezar, narrar, mirar, esperar, reposo } = u
      await hastaElPrestamo(u)
      await bajarHasta(u, 'text=Pagaré')
      empezar()
      await narrar(0, { mirar: 'text=Pagaré >> visible=true', escala: 1.8 })
      await narrar(1, {
        hacer: async () => {
          await mirar('text=Comprobante >> visible=true', { escala: 1.8, ms: 2600 })
          await esperar(300)
        },
      })
      await narrar(2)
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
  nombre: 'préstamos',
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-15',
  final: '/home/keyce/Desktop/videos-tutoriales/15-prestamos.mp4',
  tomas: TOMAS,
  cookie,
})
