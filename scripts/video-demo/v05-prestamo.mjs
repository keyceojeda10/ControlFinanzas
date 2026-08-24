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
    /* ⚠ Y SUS MOVIMIENTOS, no solo la fila.
       Borraba el `Prestamo` y dejaba su desembolso en el libro. El resultado se
       vio tres vídeos después: la caja del dueño abría con un aviso rojo —«hoy
       la cuenta no cierra: $400.000 de préstamos que no cuadran»— y parecía un
       fallo del sistema. Era esta limpieza a medias. */
    const [mios] = await cx.query(
      `SELECT id FROM Prestamo WHERE clienteId = ? AND montoPrestado = ? AND DATE(createdAt) = CURDATE()`,
      [c.id, Number(MONTO)])
    const ids = mios.map((x) => x.id)
    if (ids.length) {
      await cx.query('DELETE FROM Pago WHERE prestamoId IN (?)', [ids]).catch(() => {})
      await cx.query('DELETE FROM MovimientoCapital WHERE referenciaId IN (?)', [ids]).catch(() => {})
      await cx.query('DELETE FROM Prestamo WHERE id IN (?)', [ids]).catch(() => {})
    }
  }
  await cx.end()
}

/** Camino común hasta la pantalla de condiciones. */
const hastaCondiciones = async ({ ir, tocar, esperar, escribir, p }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocar('Crear'); await esperar(1200)
  await tocar('Prestarle a alguien')
  /* ⚠ AL CLIENTE SE LLEGA BUSCÁNDOLO, NO PULSÁNDOLO EN «RECIENTES».
     Antes era `tocar(CLIENTE)` a secas y hoy revienta: RECIENTES solo enseña
     TRES, y desde que se grabó este vídeo esos tres son otros. Diez segundos
     esperando a un botón que no existe, y el error sale como si fuera del
     guion. Buscar por el nombre no depende de qué estuvo reciente. */
  await p.waitForSelector('text=Elige el cliente', { timeout: 25000 }).catch(() => {})
  await esperar(800)
  await escribir('input[placeholder*="Buscar por nombre"]', 'Fabi')
  await esperar(1400)
  await tocar(CLIENTE); await esperar(900)
  await tocar('Continuar')
}

/* == EL RITMO LO PONE LA VOZ ==============================================
 *
 * Reescrito con `narrar(i)`: cada parada dura lo que dura SU FRASE, leida del
 * mp3 ya generado, y lo que la pantalla hace ocurre DENTRO de la frase. Ver la
 * nota larga de `grabador.mjs`; el motivo, medido en el video 14, fue 76
 * segundos de pantalla quieta en 3:57.
 *
 * ATENCION: UNA PARADA, UNA FRASE DE LA LOCUCION. Donde el guion tenia dos
 * rotulos para un solo parrafo, los dos acercamientos van dentro del mismo
 * `narrar`: si no, `narrar(1)` pediria un parrafo que no existe y la toma
 * revienta al grabar.
 *
 *     node scripts/video-demo/voz.mjs 05-prestamo --solo-audio
 *     SIN_ROTULOS=1 LOCUCION=05-prestamo node scripts/video-demo/v05-prestamo.mjs
 */
/* El campo del monto. Vive aquí arriba y no debajo del array: un `const`
   declarado después de quien lo usa es la clase de despiste que en este repo ya
   ha dejado tres pantallas en blanco. */
const CAMPO = 'input[inputmode="decimal"], input[type="text"]'

const TOMAS = [
  {
    id: 'entrada',
    titulo: 'Donde se crea un prestamo',
    async grabar(u) {
      const { ir, esperar, tocar, empezar, narrar, reposo } = u
      await ir('/dashboard', /Buenos|Recaudado/i)
      await esperar(1200)
      empezar()
      /* EL PANEL, QUIETO, ANTES DE TOCAR NADA.
         Esta toma SI ensenaba el camino, pero duraba un suspiro: `empezar()` y
         acto seguido el toque, asi que el panel se veia tres decimas y el dueno
         lo dio por perdido. Se ve en el fotograma diez del video viejo: la hoja
         ya esta abierta. */
      await esperar(700)
      await narrar(0, {
        mirar: 'button[aria-label="Crear"]', escala: 2.4,
        hacer: async () => { await tocar('Crear'); await esperar(2000) },
      })
      await narrar(1, {
        mirar: 'text=Prestarle a alguien', escala: 1.8,
        hacer: async () => { await tocar('Prestarle a alguien'); await esperar(1800) },
      })
      await reposo(1600)
    },
  },
  {
    id: 'cliente',
    titulo: 'A quien le prestas',
    async grabar(u) {
      const { ir, esperar, tocar, empezar, narrar, reposo, escribir, p } = u
      await ir('/dashboard', /Buenos|Recaudado/i)
      await tocar('Crear'); await esperar(1200)
      await tocar('Prestarle a alguien')
      await p.waitForSelector('text=Elige el cliente', { timeout: 25000 }).catch(() => {})
      empezar()
      await esperar(700)
      await narrar(0, { mirar: 'text=RECIENTES', escala: 1.7 })
      /* Se busca y se elige DENTRO de la frase que habla de buscar: antes se
         decia «los demas, buscando por nombre o cedula» sobre una lista quieta
         y el toque venia cuando ya se habia callado. */
      await narrar(1, {
        hacer: async () => {
          await escribir('input[placeholder*="Buscar por nombre"]', 'Fabi')
          await esperar(1600)
          await tocar(CLIENTE); await esperar(1400)
          await tocar('Continuar'); await esperar(1600)
        },
      })
      await reposo(1600)
    },
  },
  {
    id: 'monto',
    titulo: 'Cuanto le prestas',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, reposo } = u
      await hastaCondiciones(u)
      empezar()
      await narrar(0, { hacer: async () => { await escribir(CAMPO, MONTO); await esperar(1400) } })
      await narrar(1, { mirar: 'button:has-text("500k")', escala: 1.9 })
      await reposo(1400)
    },
  },
  {
    id: 'frecuencia',
    titulo: 'Cada cuanto te paga',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      /* Se tocan DOS frecuencias mientras se nombran las cuatro: con una sola no
         se ve que la cuota de abajo cambia al cambiarlas. */
      await narrar(0, {
        hacer: async () => {
          await tocar('Semanal'); await esperar(1500)
          await tocar('Diario'); await esperar(1300)
        },
      })
      await narrar(1, { mirar: 'button:has-text("Diario")', escala: 1.8 })
      await reposo(1400)
    },
  },
  {
    id: 'interes',
    titulo: 'La tasa de interes',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      // Un solo parrafo en la locucion y dos cosas que ensenar: van juntas.
      await narrar(0, {
        mirar: 'button:has-text("20%")', escala: 1.9,
        hacer: async () => {
          await esperar(300)
          await mirar('button:has-text("10%")', { escala: 1.9, ms: 2000 })
        },
      })
      await reposo(1400)
    },
  },
  {
    id: 'cuotas',
    titulo: 'Cuantas cuotas, y el No se',
    async grabar(u) {
      const { escribir, empezar, narrar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      await narrar(0, { mirar: 'button:has-text("30")', escala: 1.9 })
      await narrar(1, { mirar: 'button:has-text("No sé")', escala: 1.9 })
      await reposo(1400)
    },
  },
  {
    id: 'cuenta',
    titulo: 'La cuenta se hace sola',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, mirar, reposo, p } = u
      await hastaCondiciones(u)
      empezar()
      /* La cifra se calcula MIENTRAS se escribe, asi que el monto se teclea
         dentro de la frase que lo cuenta. Antes se escribia antes de empezar y
         el rotulo hablaba de un numero que ya estaba puesto. */
      await narrar(0, {
        hacer: async () => {
          await escribir(CAMPO, MONTO)
          await esperar(1600)
          await p.locator('text=CUOTA DIARIA').first().scrollIntoViewIfNeeded().catch(() => {})
          await esperar(500)
          await mirar('text=TOTAL A PAGAR', { escala: 1.7, ms: 3000, fila: true })
            .catch(async () => { await mirar('text=CUOTA DIARIA', { escala: 1.7, ms: 3000, fila: true }) })
        },
      })
      await reposo(1600)
    },
  },
  {
    id: 'modo-que-es',
    titulo: 'El modo de interes: por que importa',
    async grabar(u) {
      const { escribir, empezar, narrar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      await narrar(0, { mirar: 'text=¿Cómo cobra el interés?', escala: 1.7 })
      await narrar(1)
      await reposo(1400)
    },
  },
  {
    id: 'ayudante',
    titulo: 'El ayudante de dos preguntas',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      await narrar(0, { mirar: 'text=Responde 2 preguntas', escala: 1.7 })
      await narrar(1, {
        hacer: async () => { await tocar('Responde 2 preguntas'); await esperar(2000) },
      })
      await reposo(1400)
    },
  },
  {
    id: 'en-tus-palabras',
    titulo: 'Las opciones, en tus palabras',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, tocar, mirar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      await tocar('Responde 2 preguntas')
      await esperar(1600)
      empezar()
      await narrar(0, { mirar: 'text=Le cobro una cuota igual cada vez', escala: 1.6 })
      await narrar(1, { mirar: 'text=Le cobro solo el interés', escala: 1.6 })
      await narrar(2, { mirar: 'text=Le cobro un interés fijo, una sola vez', escala: 1.6 })
      /* El cuarto parrafo cierra la idea y la pantalla lo acompana volviendo a
         la lista entera. */
      await narrar(3, {
        hacer: async () => {
          await mirar('text=Le cobro una cuota igual cada vez', { escala: 1.3, ms: 2600, fila: true })
        },
      })
      await reposo(1600)
    },
  },
  {
    id: 'recomendado',
    titulo: 'El que usa casi todo el mundo',
    async grabar(u) {
      const { escribir, empezar, narrar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      await narrar(0, { mirar: 'text=RECOMENDADO', escala: 1.7 })
      await narrar(1)
      await reposo(1400)
    },
  },
  {
    id: 'revisar',
    titulo: 'Revisar y crear',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      empezar()
      await narrar(0, {
        mirar: 'button:has-text("Revisar préstamo")', escala: 1.7,
        hacer: async () => { await tocar('Revisar préstamo', { espera: 2600 }); await esperar(1400) },
      })
      await reposo(1800)
    },
  },
  {
    id: 'cierre',
    titulo: 'Crear el prestamo y verlo vivo',
    async grabar(u) {
      const { esperar, escribir, empezar, narrar, tocar, reposo } = u
      await hastaCondiciones(u)
      await escribir(CAMPO, MONTO)
      await tocar('Revisar préstamo', { espera: 3200 })
      empezar()
      await esperar(700)
      /* AQUI SE CREA DE VERDAD. El video se cortaba en la pantalla de revisar y
         no se veia el prestamo hecho ni donde queda. */
      await narrar(0, {
        hacer: async () => {
          await tocar('Crear préstamo', { espera: 4200 }).catch(async () => {
            await tocar('Confirmar', { espera: 4200 })
          })
        },
      })
      /* ESTO NO LO SABIA HASTA QUE EL VIDEO LLEGO AL FINAL: al crear el
         prestamo, el sistema arma solo el mensaje para el cliente -monto,
         cuota, fechas y plazo- listo para mandar por WhatsApp. Es de lo mejor
         que hace y estaba escondido detras de un corte. */
      await narrar(1)
      await reposo(2400)
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
  dir: '/home/keyce/Desktop/videos-tutoriales/tomas-05',
  final: '/home/keyce/Desktop/videos-tutoriales/05-prestamo.mp4',
  tomas: TOMAS,
  cookie: token,
  antesDeToma: limpiarPrestamos,
})
await limpiarPrestamos()
