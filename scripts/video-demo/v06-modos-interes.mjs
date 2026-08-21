// scripts/video-demo/v06-modos-interes.mjs
//
// VÍDEO 6 · Todos los modos de interés, incluidos los avanzados
//
//     node scripts/video-demo/v06-modos-interes.mjs
//     node scripts/video-demo/v06-modos-interes.mjs --toma 5
//     node scripts/video-demo/v06-modos-interes.mjs --pegar
//
// El 5 enseña a CREAR un préstamo y toca el modo de interés de pasada. Este es
// el monográfico, y existe por una razón concreta:
//
//   El mismo préstamo —$400.000 al 20%, 30 cobros diarios— da esto:
//
//     Cuota fija ......... cuota  $16.000 · total   $480.000 · interés    $80.000
//     De una vez ......... cuota  $16.000 · total   $480.000 · interés    $80.000
//     Globo .............. cuota  $80.000 · total $2.800.000 · interés $2.400.000
//     Como los bancos .... cuota  $14.800 · total   $442.523 · interés    $42.523
//     Decreciente ........ cuota  $93.333 · total $1.640.019 · interés $1.240.019
//     Dinámico ........... cuota  $93.333 · total $1.640.019 · interés $1.240.019
//
// Treinta veces de diferencia con el MISMO porcentaje. Y no es un fallo: es que
// el 20% no significa lo mismo en los seis. Eso es lo que hay que enseñar.
//
// ── LO QUE MANDA ES LA BASE, NO EL NOMBRE ──────────────────────────────────
//
// La pantalla ya lo dice, en un renglón de color debajo de cada modo:
//
//     «El % es por mes»              -> fijo, saldo
//     «El % es de todo el préstamo»  -> unico
//     «El % es por cada cobro»       -> solo_interes, lineal, lineal_dinamico
//
// Los tres de «por cada cobro» son los que se disparan en diario: 30 cobros son
// 30 veces el 20%. Están pensados para mensual, y ahí las cifras se ordenan
// solas (comprobado con `calcularPrestamo`, mismo préstamo a 3 cobros mensuales):
//
//     Cuota fija $640.200 · De una vez $480.000 · Globo $640.000 · Bancos $569.664
//
// El aviso de la toma «globo» sale de ahí, y es lo que más plata puede salvar.
//
// ── POR QUÉ FIJA Y DE UNA VEZ SALEN IGUALES ────────────────────────────────
//
// Porque 30 días es UN mes justo: 20% por mes × 1 mes = 20% del préstamo. Se
// separan en cuanto el préstamo dura más. A 60 días: $564.000 contra $480.000.
// La toma «unico» lo dice con esas dos cifras, porque si no, el espectador ve
// dos modos idénticos y concluye que da igual cuál elija.

import { encode } from 'next-auth/jwt'
import { correr, SECRETO } from './grabador.mjs'
import { IDS } from './montar-demo.mjs'

const CLIENTE = 'Fabián Quintero'
const MONTO = '400000'

/** Botón de un modo, por su nombre en la lista. */
const modo = (n) => `button:has-text("${n}")`

/**
 * Camino común: hasta la lista de modos, con el monto ya escrito Y LA SECCIÓN
 * DE MODOS YA EN PANTALLA.
 *
 * ⚠ EL ARRASTRE VA ANTES DE `empezar()`. Sin él, cada toma abría cuatro o cinco
 * segundos sobre el campo del monto —arriba del formulario— mientras el rótulo
 * hablaba de los modos, y el acercamiento llegaba después dando el salto. Se
 * vio en el fotograma, no en el código: la escaleta decía que todo cuadraba.
 */
const hastaModos = async ({ ir, tocar, esperar, escribir, p }) => {
  await ir('/dashboard', /Buenos|Recaudado/i)
  await tocar('Crear'); await esperar(1200)
  await tocar('Prestarle a alguien'); await esperar(1600)
  await tocar(CLIENTE); await esperar(900)
  await tocar('Continuar'); await esperar(1200)
  await escribir('input[inputmode="decimal"], input[type="text"]', MONTO)
  await esperar(1600)
  await p.locator('button:has-text("¿No sabes cuál usar?")').first()
    .scrollIntoViewIfNeeded().catch(() => {})
  await esperar(1200)
}

const TOMAS = [
  {
    id: 'donde',
    titulo: 'Dónde se elige el modo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('Al hacer un préstamo, más abajo, «modo de interés»', 4.6)
      await esperar(4800)
      await mirar('label:has-text("Modo de interés")', { escala: 1.6, ms: 4000 })
      await esperar(700)
      await decir('Aquí se decide cómo le cobras el interés', 4.2)
      await esperar(4400)
      await reposo(3000)
    },
  },
  {
    id: 'el_aviso',
    titulo: 'El mismo 20% no vale lo mismo',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El mismo préstamo, el mismo veinte por ciento…', 4.4)
      await esperar(4600)
      await mirar(modo('Cuota fija'), { escala: 1.7, ms: 4400 })
      await esperar(900)
      await decir('…y aquí la cuenta es otra completamente distinta', 4.4)
      await esperar(4600)
      await mirar(modo('Solo interés, capital al final'), { escala: 1.7, ms: 4400 })
      await esperar(700)
      await reposo(3200)
    },
  },
  {
    id: 'la_base',
    titulo: 'Lo que manda es la base del porcentaje',
    async grabar(u) {
      const { esperar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('La clave está en un renglón de color', 4.0)
      await esperar(4200)
      await decir('«Por mes»: se reparte según lo que dure', 4.2)
      await esperar(1400)
      await mirar('p:has-text("El % es por mes")', { escala: 2.1, ms: 4000 })
      await esperar(3800)
      await decir('«De todo el préstamo»: se cobra una vez y ya', 4.2)
      await esperar(1400)
      await mirar('p:has-text("El % es de todo el préstamo")', { escala: 2.1, ms: 4000 })
      await esperar(3800)
      await decir('«Por cada cobro»: se cobra CADA vez que cobras', 4.6)
      await esperar(1600)
      await mirar('p:has-text("El % es por cada cobro")', { escala: 2.1, ms: 4200 })
      await esperar(3600)
      await reposo(3200)
    },
  },
  {
    id: 'fija',
    titulo: 'Cuota fija · el recomendado',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El primero es cuota fija, y es el que trae puesto', 4.6)
      await esperar(4800)
      await tocar('Cuota fija')
      await esperar(1400)
      await decir('Treinta cuotas de dieciséis mil. Total, cuatrocientos ochenta mil', 5.0)
      await esperar(1600)
      await mirar(modo('Cuota fija'), { escala: 1.7, ms: 4800 })
      await esperar(900)
      await decir('Paga lo mismo cada vez, de principio a fin', 4.4)
      await esperar(4600)
      await reposo(3200)
    },
  },
  {
    id: 'unico',
    titulo: 'De una vez · el interés no crece',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El segundo: el veinte por ciento es de todo el préstamo', 4.8)
      await esperar(5000)
      await tocar('Interés de una sola vez')
      await esperar(1400)
      await decir('Da la misma cifra… porque treinta días es un mes justo', 4.8)
      await esperar(1600)
      await mirar(modo('Interés de una sola vez'), { escala: 1.7, ms: 4800 })
      await esperar(3400)
      await decir('A sesenta días la fija sube a quinientos sesenta y cuatro mil', 5.2)
      await esperar(6800)
      await decir('Esta se queda en cuatrocientos ochenta, dure lo que dure', 5.0)
      await esperar(6600)
      await reposo(3600)
    },
  },
  {
    id: 'globo',
    titulo: 'Globo · y el aviso de la frecuencia',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El tercero: cada cobro es solo tu ganancia', 4.4)
      await esperar(4600)
      await tocar('Solo interés, capital al final')
      await esperar(1400)
      await decir('El capital completo vuelve al final, de una', 4.4)
      await esperar(1600)
      await mirar(modo('Solo interés, capital al final'), { escala: 1.7, ms: 4800 })
      await esperar(900)
      await decir('Ojo con la cifra: ochenta mil por cobro, dos millones ochocientos', 5.4)
      await esperar(5600)
      await decir('Porque ese veinte por ciento se cobra los treinta días', 4.8)
      await esperar(5000)
      await decir('Este modo es para mensual. En diario multiplica por treinta', 5.0)
      await esperar(5600)
      await reposo(6000)
    },
  },
  {
    id: 'saldo',
    titulo: 'Como los bancos · el interés baja',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El cuarto es el que usan los bancos', 4.0)
      await esperar(4200)
      await tocar('Interés sobre lo que falta')
      await esperar(1400)
      await decir('El interés va sobre lo que aún debe, y baja según abona', 5.0)
      await esperar(1600)
      await mirar(modo('Interés sobre lo que falta'), { escala: 1.7, ms: 4800 })
      await esperar(2800)
      await decir('Cuarenta y dos mil de interés, contra los ochenta de la fija', 5.0)
      await esperar(5600)
      await reposo(4000)
    },
  },
  {
    id: 'manual',
    titulo: 'Yo decido la cuota',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('El quinto es para cuando tú ya sabes cuánto va a pagar', 5.0)
      await esperar(5200)
      await tocar('Yo decido la cuota')
      await esperar(1600)
      await decir('Pones la cuota y el sistema saca cuántos cobros hacen falta', 5.2)
      await esperar(1600)
      await mirar(modo('Yo decido la cuota'), { escala: 1.8, ms: 4800 })
      await esperar(900)
      await decir('Aquí el porcentaje no se usa para nada', 4.2)
      await esperar(4400)
      await reposo(3200)
    },
  },
  {
    id: 'avanzados',
    titulo: 'Los dos modos avanzados',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('Abajo del todo hay dos modos más, escondidos', 4.4)
      await esperar(4600)
      await mirar('button:has-text("Ver modos avanzados")', { escala: 1.9, ms: 3800 })
      await tocar('Ver modos avanzados')
      await esperar(2400)
      await decir('La que va bajando: capital parejo e interés cada vez menos', 5.2)
      await esperar(1600)
      await mirar(modo('Cuota que va bajando'), { escala: 1.7, ms: 4800 })
      await esperar(900)
      await decir('Y la que se ajusta recalcula según lo que de verdad pagó', 5.2)
      await esperar(1600)
      await mirar(modo('Cuota que se ajusta al pago real'), { escala: 1.7, ms: 4800 })
      await esperar(900)
      await decir('Los dos son «por cada cobro»: en diario también se disparan', 5.2)
      await esperar(5800)
      await reposo(6600)
    },
  },
  {
    id: 'asistente',
    titulo: 'El ayudante de dos preguntas',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await decir('Y si todo esto te suena a chino, no adivines', 4.4)
      await esperar(4600)
      await mirar('button:has-text("¿No sabes cuál usar?")', { escala: 1.7, ms: 4000 })
      await tocar('¿No sabes cuál usar?')
      await esperar(2600)
      await decir('No pregunta por fórmulas: pregunta cómo cobras tú', 4.8)
      await esperar(5000)
      await tocar('Le cobro una cuota igual cada vez')
      await esperar(2400)
      await decir('Y una segunda: si el cliente abona, ¿el interés baja?', 5.0)
      await esperar(5200)
      await tocar('Se mantiene parejo')
      await esperar(2600)
      await decir('Te dice cuál es el tuyo, con la cuenta ya hecha', 4.6)
      await esperar(1600)
      await mirar('text=Tu modo ideal es', { escala: 1.6, ms: 4600 })
      await esperar(900)
      await reposo(3400)
    },
  },
  {
    id: 'cierre',
    titulo: 'Dejarlo puesto y seguir',
    async grabar(u) {
      const { esperar, tocar, empezar, decir, mirar, reposo } = u
      await hastaModos(u)
      empezar()
      await tocar('¿No sabes cuál usar?')
      await esperar(1800)
      await tocar('Le cobro una cuota igual cada vez'); await esperar(1600)
      await tocar('Se mantiene parejo'); await esperar(2200)
      await decir('«Usar siempre este modo» te lo deja puesto para todos', 5.0)
      await esperar(1600)
      await mirar('button:has-text("Usar siempre este modo")', { escala: 1.7, ms: 4400 })
      await esperar(700)
      await tocar('Usar siempre este modo')
      await esperar(2400)
      await decir('Y queda marcado como tu modo habitual', 4.4)
      await esperar(1600)
      await mirar(modo('Cuota fija'), { escala: 1.7, ms: 4400 })
      await esperar(900)
      await decir('Si dudas, cuota fija. Y siempre lo puedes cambiar', 4.8)
      await esperar(5000)
      await tocar('Revisar préstamo')
      await esperar(3200)
      await reposo(4200)
    },
  },
]

const cookie = await encode({
  token: {
    sub: IDS.owner, id: IDS.owner, email: 'demo@ejemplo.com', name: 'Santiago', rol: 'owner',
    organizationId: IDS.org, plan: 'professional', country: 'co',
    orgNombre: 'Créditos del Valle', rutaIds: [],
  },
  secret: SECRETO,
})

await correr({
  nombre: 'modos de interés',
  dir: '/tmp/videos/06-modos',
  final: '/tmp/videos/06-modos-interes.mp4',
  tomas: TOMAS,
  cookie,
})
