// scripts/video-demo/v05-prestamo.mjs
//
// VÍDEO 5 · Crear un préstamo, y elegir bien el modo de interés
//
//     node scripts/video-demo/v05-prestamo.mjs
//     node scripts/video-demo/v05-prestamo.mjs --toma 8
//     node scripts/video-demo/v05-prestamo.mjs --pegar
//
// El más importante después del onboarding, y el más denso: el modo de interés
// cambia cuánto gana el negocio con el MISMO porcentaje. El sistema tiene un
// ayudante de dos preguntas escrito en el idioma del prestamista —«le cobro una
// cuota igual cada vez», «le cobro solo el interés y el capital al final»— y eso
// es justo lo que hay que enseñar: no hace falta entender la fórmula.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { conectar, IDS } from './montar-demo.mjs'

const CLIENTE = 'Fabián Quintero'
const MONTO = '400000'

/** Deja al cliente sin el préstamo de la demostración, para poder repetir. */
const limpiarPrestamos = async () => {
  const cx = await conectar()
  const [[c]] = await cx.query(
    'SELECT id FROM Cliente WHERE organizationId = ? AND nombre = ?', [IDS.org, CLIENTE])
  if (c) {
    // Solo los creados hoy por la grabación: los del negocio de mentira se quedan.
    await cx.execute(
      `DELETE FROM Prestamo WHERE clienteId = ? AND montoPrestado = ? AND DATE(createdAt) = CURDATE()`,
      [c.id, Number(MONTO)]).catch(() => {})
  }
  await cx.end()
}

/** Camino común hasta la pantalla de condiciones. */
const hastaCondiciones = async ({ ir, tocar, esperar }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocar('Crear'); await esperar(1200)
  await tocar('Prestarle a alguien'); await esperar(1600)
  await tocar(CLIENTE); await esperar(900)
  await tocar('Continuar')
}

const TOMAS = [
  {
    id: 'entrada',
    titulo: 'Dónde se crea un préstamo',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Buenos|Recaudado/i)
      await esperar(1200)
      empezar()
      /* ⚠ EL PANEL, QUIETO, ANTES DE TOCAR NADA.
         Esta toma SÍ enseñaba el camino, pero duraba un suspiro: `empezar()` y
         acto seguido el toque, así que el panel se veía tres décimas y el dueño
         lo dio por perdido —«no dice cómo llega»—. Se ve en el fotograma diez
         del vídeo viejo: la hoja ya está abierta.
         Ahora se para, se señala el botón y luego se pulsa. */
      await esperar(1400)
      await decir('Un préstamo se hace desde el mismo botón «Crear»', 4.4)
      await esperar(1400)
      await mirar('button[aria-label="Crear"]', { escala: 2.4, ms: 3400 })
      await esperar(2600)
      await tocar('Crear')
      await esperar(3400)
      await mirar('text=Prestarle a alguien', { escala: 1.8, ms: 4200 })
      await decir('Aquí, en «sale plata»: «Prestarle a alguien»', 4.4)
      await esperar(4600)
      await tocar('Prestarle a alguien')
      await reposo()
    },
  },
  {
    id: 'cliente',
    titulo: 'A quién le prestas',
    async grabar({ ir, esperar, tocar, empezar, decir, mirar, reposo }) {
      await ir('/dashboard', /Buenos|Recaudado/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Prestarle a alguien')
      empezar()
      await esperar(1600)
      await decir('Lo primero: a quién', 3.6)
      await esperar(3800)
      await mirar('text=RECIENTES', { escala: 1.7, ms: 4000 })
      await decir('Los últimos salen de primeras; los demás, buscando por nombre o cédula', 4.8)
      await esperar(5000)
      await tocar(CLIENTE)
      await esperar(1800)
      await tocar('Continuar')
      await reposo()
    },
  },
  {
    id: 'monto',
    titulo: 'Cuánto le prestas',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      empezar()
      await decir('Cuánto le entregas en la mano', 4.0)
      await esperar(4200)
      await mirar('button:has-text("500k")', { escala: 1.9, ms: 4000 })
      await decir('Los montos de siempre están ahí, en un toque', 4.2)
      await esperar(4400)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await esperar(2600)
      await reposo()
    },
  },
  {
    id: 'frecuencia',
    titulo: 'Cada cuánto te paga',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Cada cuánto te paga: diario, semanal, quincenal o mensual', 4.8)
      await esperar(5000)
      await mirar('button:has-text("Diario")', { escala: 1.8, ms: 4000 })
      await decir('En diario cobra todos los días hábiles', 4.2)
      await esperar(4400)
      await reposo()
    },
  },
  {
    id: 'interes',
    titulo: 'La tasa de interés',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Ahora el interés', 3.4)
      await esperar(3600)
      await mirar('button:has-text("20%")', { escala: 1.9, ms: 4200 })
      await decir('Los porcentajes que más se usan están de atajo', 4.4)
      await esperar(4600)
      await reposo()
    },
  },
  {
    id: 'cuotas',
    titulo: 'Cuántas cuotas, y el «No sé»',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await decir('Y en cuántas cuotas te lo paga', 4.0)
      await esperar(4200)
      await mirar('button:has-text("No sé")', { escala: 1.9, ms: 4600 })
      await decir('Si no sabes cuándo te paga, toca «No sé»', 4.2)
      await esperar(4400)
      await decir('El préstamo queda sin vencimiento y solo cobra el interés de cada mes', 4.8)
      await esperar(5000)
      await reposo()
    },
  },
  {
    id: 'cuenta',
    titulo: 'La cuenta se hace sola',
    async grabar(u) {
      const { p, esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1600)
      await mirar('text=Total a pagar', { escala: 1.7, ms: 4600 }).catch(async () => {
        await mirar('text=CUOTA', { escala: 1.7, ms: 4600 })
      })
      await decir('Fíjate abajo: la cuota y el total salen solos', 4.6)
      await esperar(4800)
      await decir('No tienes que sacar cuentas ni con calculadora', 4.4)
      await esperar(4600)
      await reposo()
    },
  },
  {
    id: 'modo-que-es',
    titulo: 'El modo de interés: por qué importa',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1400)
      await mirar('text=¿Cómo cobra el interés?', { escala: 1.7, ms: 4400 })
      await decir('Y ahora lo más importante de esta pantalla', 4.2)
      await esperar(4400)
      await decir('Cómo cobras el interés: el mismo veinte por ciento puede ser tres cosas distintas', 5.2)
      await esperar(5400)
      await reposo()
    },
  },
  {
    id: 'ayudante',
    titulo: 'El ayudante de dos preguntas',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1200)
      await mirar('text=Responde 2 preguntas', { escala: 1.7, ms: 4400 })
      await decir('Si no sabes cuál te toca, no adivines', 4.2)
      await esperar(4400)
      await tocar('Responde 2 preguntas')
      await esperar(2600)
      await decir('Te pregunta cómo le cobras a un cliente normal', 4.6)
      await esperar(4800)
      await reposo()
    },
  },
  {
    id: 'en-tus-palabras',
    titulo: 'Las opciones, en tus palabras',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await tocar('Responde 2 preguntas')
      empezar()
      await esperar(1600)
      await mirar('text=Le cobro una cuota igual cada vez', { escala: 1.6, ms: 4600 })
      await decir('«Le cobro una cuota igual cada vez»: el más común', 4.6)
      await esperar(4800)
      await mirar('text=Le cobro solo el interés', { escala: 1.6, ms: 4600 })
      await decir('«Solo el interés, y el capital al final, de una»', 4.6)
      await esperar(4800)
      await mirar('text=Le cobro un interés fijo, una sola vez', { escala: 1.6, ms: 4800 })
      await decir('«Presto cien mil y me devuelve ciento veinte, se demore lo que se demore»', 5.2)
      await esperar(5400)
      await reposo()
    },
  },
  {
    id: 'recomendado',
    titulo: 'El que usa casi todo el mundo',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1400)
      await mirar('text=RECOMENDADO', { escala: 1.7, ms: 4400 })
      await decir('Si no estás seguro, déjalo en «cuota fija»', 4.4)
      await esperar(4600)
      await decir('Es el que usa casi todo el mundo y el que viene puesto', 4.6)
      await esperar(4800)
      await reposo()
    },
  },
  {
    id: 'revisar',
    titulo: 'Revisar y crear',
    async grabar(u) {
      const { p, esperar, escribir, empezar, decir, mirar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      empezar()
      await esperar(1200)
      await mirar('button:has-text("Revisar préstamo")', { escala: 1.7, ms: 4000 })
      await decir('Antes de crearlo, lo revisas', 4.0)
      await esperar(4200)
      await tocar('Revisar préstamo', { espera: 3600 })
      await decir('Aquí ves cómo queda antes de entregar la plata', 4.6)
      await esperar(4800)
      await reposo()
    },
  },
  {
    id: 'cierre',
    titulo: 'Crear el préstamo y verlo vivo',
    async grabar(u) {
      const { esperar, escribir, empezar, decir, mirar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
      await tocar('Revisar préstamo', { espera: 3200 })
      empezar()
      await esperar(1600)
      await decir('Revisa que todo esté como quedaste con el cliente', 4.6)
      await esperar(4800)
      /* ⚠ AQUÍ SE CREA DE VERDAD. El vídeo se cortaba en la pantalla de revisar
         y no se veía el préstamo hecho ni dónde queda. */
      await tocar('Crear préstamo', { espera: 4600 }).catch(async () => {
        await tocar('Confirmar', { espera: 4600 })
      })
      await decir('Y ya está: el préstamo queda hecho', 4.0)
      await esperar(4400)
      /* ⚠ ESTO NO LO SABÍA HASTA QUE EL VÍDEO LLEGÓ AL FINAL: al crear el
         préstamo, el sistema arma solo el mensaje para el cliente —monto, cuota,
         fechas y plazo— listo para mandar por WhatsApp. Es de lo mejor que hace
         y estaba escondido detrás de un corte. */
      await decir('Y te arma solo el mensaje para el cliente', 4.4)
      await esperar(4600)
      await decir('Con el monto, la cuota y las fechas, listo para mandar', 4.8)
      await esperar(5000)
      await reposo(3400)
    },
  },
]

const token = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Sofía Restrepo',
    rol: 'owner', organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'prestamo',
  dir: '/tmp/videos/05-prestamo',
  final: '/tmp/videos/05-prestamo.mp4',
  tomas: TOMAS,
  cookie: token,
  antesDeToma: limpiarPrestamos,
})
await limpiarPrestamos()
