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

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde están tus préstamos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await enElPanel(u)
      empezar()
      await esperar(1400)
      await decir('Los préstamos están en la barra de abajo, en el tercer icono', 4.8)
      await esperar(1400)
      await mirar('a[href="/prestamos"]:visible', { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocarSel('a[href="/prestamos"]:visible')
      await esperar(3400)
      await decir('Aquí está toda tu plata prestada, préstamo por préstamo', 4.6)
      await esperar(4800)
      await reposo(3200)
    },
  },

  {
    id: 'las_tres_cifras',
    titulo: 'Las tres cifras de arriba',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Lo primero son tres cifras, y con esas tres ya sabes cómo vas', 5.2)
      await esperar(1600)
      await mirar('text=EN LA CALLE', { escala: 1.6, ms: 4400, fila: true })
      await esperar(2800)
      await decir('Lo que tienes en la calle, lo que está en mora y lo cobrado este mes', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
  },

  {
    id: 'cada_uno',
    titulo: 'Lo que dice cada préstamo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Cada préstamo se explica solo, sin abrirlo', 4.4)
      await esperar(4600)
      await mirar('text=Wilmer Andrés Salas', { escala: 1.4, ms: 4600, fila: true })
      await esperar(2800)
      await decir('De quién es, cuánto lleva pagado, la cuota y cuánto debe de atraso', 5.4)
      await esperar(5600)
      await decir('Y cómo se pactó: si es diario, el interés y con qué modo', 5.0)
      await esperar(5200)
      await reposo(3400)
    },
  },

  {
    id: 'filtros',
    titulo: 'Los filtros, que son muchos',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Los filtros de aquí son los que más se usan de todo el sistema', 5.2)
      await esperar(1600)
      await mirar('button:has-text("En mora"):visible', { escala: 1.7, ms: 4000 })
      await esperar(2800)
      await decir('Los de siempre: activos, en mora, completados, cancelados', 4.8)
      await esperar(5000)
      await decir('Y los del calendario: los que vencen hoy, mañana, en cinco días', 5.2)
      await esperar(2200)
      await tocar('En 5 días')
      await esperar(3400)
      await decir('Con eso preparas la semana sin mirar cliente por cliente', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },

  {
    id: 'renovar_perdidos',
    titulo: 'Dos filtros que valen plata',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Y dos que conviene mirar cada semana', 4.2)
      await esperar(1600)
      await mirar('button:has-text("Renovar"):visible', { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await decir('Renovar: los que ya casi terminan y puedes volver a prestarles', 5.2)
      await esperar(5400)
      await mirar('button:has-text("Perdidos"):visible', { escala: 1.8, ms: 3800 })
      await esperar(2600)
      await decir('Y perdidos: los que diste por perdidos, aparte, para no confundirte', 5.4)
      await esperar(5600)
      await reposo(3400)
    },
  },

  {
    id: 'buscador',
    titulo: 'Buscar un préstamo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, escribir, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Y arriba el buscador, que aquí busca por el cliente', 4.4)
      await esperar(1400)
      await mirar('input[placeholder="Nombre o cédula"]:visible', { escala: 1.8, ms: 3800 })
      await esperar(2400)
      await escribir('input[placeholder="Nombre o cédula"]:visible', 'Marta')
      await esperar(3400)
      await decir('Nombre o cédula, igual que en clientes', 3.8)
      await esperar(4000)
      await reposo(3400)
    },
  },

  {
    id: 'abrir',
    titulo: 'Un préstamo por dentro',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocar, reposo } = u
      await hastaPrestamos(u)
      empezar()
      await decir('Tocas cualquiera y entras', 3.4)
      await esperar(2000)
      await tocar(CLIENTE)
      await esperar(4200)
      await decir('Lo primero es el botón grande: registrarle el pago del día', 5.0)
      await esperar(1600)
      await mirar('text=REGISTRAR PAGO DIARIO', { escala: 1.6, ms: 4400, fila: true })
      await esperar(3400)
      await reposo(3400)
    },
  },

  {
    id: 'cuanto_debe',
    titulo: 'Cuánto falta, y cuánto si cancela hoy',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaElPrestamo(u)
      empezar()
      await decir('Debajo, lo que le falta pagar y cuánto lleva', 4.6)
      await esperar(1600)
      await mirar('text=LE FALTA PAGAR', { escala: 1.6, ms: 4200, fila: true })
      await esperar(2800)
      await decir('Y algo que se pregunta mucho: cuánto sería si lo cancela hoy', 5.2)
      await esperar(1600)
      await mirar('text=Si lo cancela hoy', { escala: 1.6, ms: 4200, fila: true })
      await esperar(2800)
      await decir('Con el interés que se ahorra, ya descontado', 4.2)
      await esperar(4400)
      await reposo(3400)
    },
  },

  {
    id: 'como_se_pacto',
    titulo: 'Cómo se pactó y qué ha pagado',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaElPrestamo(u)
      await bajarHasta(u, 'text=CÓMO SE PACTÓ')
      empezar()
      await decir('Más abajo, el trato tal como quedó', 4.2)
      await esperar(1400)
      await mirar('text=CÓMO SE PACTÓ', { escala: 1.6, ms: 4200 })
      await esperar(2800)
      await decir('Cuánto le prestaste, cuánto te paga y cuánto ganas', 4.6)
      await esperar(4800)
      await decir('Y debajo, cada pago que ha hecho, uno por uno', 4.4)
      await esperar(4600)
      await reposo(3400)
    },
  },

  {
    id: 'gestion',
    titulo: 'La hoja de Gestión, que es la clave',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo } = u
      await hastaElPrestamo(u)
      empezar()
      await decir('Y ahora lo que casi nadie encuentra', 4.2)
      await esperar(1600)
      await mirar('button:has-text("Gestión"):visible', { escala: 2.2, ms: 3800 })
      await esperar(2600)
      await tocarSel('button:has-text("Gestión"):visible')
      await esperar(3400)
      await decir('Aquí dentro está todo lo que se le puede hacer a este préstamo', 5.4)
      await esperar(5600)
      await decir('Ponerle un recargo, hacerle un descuento o cambiarle el plazo', 5.2)
      await esperar(5400)
      await reposo(3600)
    },
  },

  {
    id: 'gestion_dos',
    titulo: 'Y el resto de la hoja',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, tocarSel, reposo, p } = u
      await hastaElPrestamo(u)
      await tocarSel('button:has-text("Gestión"):visible')
      await esperar(2600)
      empezar()
      await decir('Cambiarle cuándo se cobra, o dejarle días sin cobro', 4.8)
      await esperar(1600)
      await mirar('text=CAMBIA CUÁNDO SE COBRA', { escala: 1.5, ms: 4200 })
      await esperar(3000)
      await p.locator('text=CIERRA EL PRÉSTAMO').first().scrollIntoViewIfNeeded().catch(() => {})
      await esperar(1600)
      await decir('Y abajo, las formas de cerrarlo', 4.0)
      await esperar(1400)
      await mirar('text=CIERRA EL PRÉSTAMO', { escala: 1.5, ms: 4200 })
      await esperar(2800)
      await decir('Editarlo, renovarlo, cerrarlo anticipado, darlo por perdido', 5.0)
      await esperar(5200)
      await decir('Cancelarlo o eliminarlo. Cada una hace algo distinto: mira su vídeo', 5.4)
      await esperar(5600)
      await reposo(3800)
    },
  },

  {
    id: 'cierre',
    titulo: 'El pagaré y el comprobante',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaElPrestamo(u)
      await bajarHasta(u, 'text=Pagaré')
      empezar()
      await decir('Y al final, los papeles', 3.4)
      await esperar(1400)
      await mirar('text=Pagaré >> visible=true', { escala: 1.8, ms: 4000 })
      await esperar(2800)
      await decir('El pagaré para que lo firme, y el comprobante de cada cobro', 5.0)
      await esperar(5200)
      await decir('Eso es un préstamo entero. Ahora ya sabes dónde está cada cosa', 5.0)
      await esperar(5200)
      await reposo(3800)
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
