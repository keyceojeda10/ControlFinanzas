// lib/bot-v2/respuestas-fijas.js — Respuestas deterministicas para situaciones comunes.
// Si el clasificador decide escalar o rechazar, la respuesta viene de aqui, no del AI.

import { EMPRESA } from './producto.js'
import { VIDEOS } from './videos.js'

const VIDEO_INSTALAR = VIDEOS.find((v) => v.n === 2)

/* ══ CUANDO CONTESTA UNA PERSONA, Y NO EL BOT ══════════════════════════════
 *
 * Revisados el 8 sep 2026 (auditoría de Kimi, punto 8). Tenían tres problemas:
 *
 *  1. No decían nada del problema del cliente. «Hable con soporte» a secas,
 *     después de que alguien cuente que su caja no cuadra, se lee como que lo
 *     están despachando.
 *  2. Prometían de más. El aviso al equipo tiene un enfriamiento (el webhook no
 *     re-alerta si ya avisó hace poco), así que «ya le paso su caso» no siempre
 *     era verdad. Ahora se dice lo que SÍ es cierto siempre: que eso lo ve
 *     mejor una persona, y por dónde encontrarla.
 *  3. Iban sin tildes.
 *
 * Y hay dos nuevos, para los dos niveles que el bot NO contesta nunca: las
 * preguntas de plata y los fallos técnicos.
 */
export const ESCALAMIENTO = {
  pide_humano: `Claro. Escriba directo al ${EMPRESA.telefonoSoporte} y le contesta una persona del equipo.\n\nAtienden de ${EMPRESA.horarioSoporte}.`,

  intencion_pago: `Para activar su plan lo acompaña el equipo directamente.\n\nEscriba al ${EMPRESA.telefonoSoporte} y le ayudan con el pago y la activación. Atienden de ${EMPRESA.horarioSoporte}.`,

  soporte: `Eso lo ve mejor una persona del equipo, que puede mirar su caso concreto.\n\nEscriba al ${EMPRESA.telefonoSoporte} y le resuelven en vivo, de ${EMPRESA.horarioSoporte}.`,

  soporte_registrado: `Entiendo. Eso conviene mirarlo con una persona del equipo, que ve su cuenta y le dice exactamente qué pasó.\n\nEscriba al ${EMPRESA.telefonoSoporte}, de ${EMPRESA.horarioSoporte}, y le ayudan paso a paso.`,

  /* Al que YA es cliente y quiere pagar no se le da un teléfono: se le da el
     sitio donde se paga. Es el 23 % de lo que escribe la gente registrada (34
     preguntas de 27 personas, medido el 2 sep) y hasta ahora recibía el número
     de soporte y punto; peor todavía, alguna vez recibió «el pago lo hace en el
     link de registro que ya le enviamos», que es falso. Sigue avisando al
     equipo: alguien que quiere pagar es dinero entrando. */
  intencion_pago_registrado: `Se paga desde su misma cuenta, en la sección de planes:\n\n${EMPRESA.linkPago}\n\nAhí elige el plan y queda activo de una. Si prefiere que le ayuden, escriba al ${EMPRESA.telefonoSoporte}, de ${EMPRESA.horarioSoporte}.`,

  /* Plata: NUNCA lo contesta el bot. Si se equivoca aquí, el prestamista
     descuadra su dinero de verdad y el error se lo lleva a la calle. */
  dinero: `Con las cuentas prefiero no adivinar: un número mal en su caja le puede costar plata de verdad.\n\nEscriba al ${EMPRESA.telefonoSoporte} y una persona del equipo le revisa su caso con los datos a la vista. Atienden de ${EMPRESA.horarioSoporte}.`,

  /* Técnico: un «reinicie e intente otra vez» del bot pierde al cliente. */
  tecnico: `Eso suena a algo que hay que mirar en su cuenta, no se lo puedo resolver por aquí.\n\nEscriba al ${EMPRESA.telefonoSoporte} contándoles qué le sale en pantalla, y lo revisan de una. Atienden de ${EMPRESA.horarioSoporte}.`,
}

/* ══ QUIEN PIDE VÍDEOS, RECIBE LA LISTA ════════════════════════════════════
 *
 * Va como respuesta FIJA y no por el modelo, por lo mismo que el resto de este
 * fichero: un enlace que el modelo escriba de memoria es un enlace inventado, y
 * un enlace roto mandado a un lead es peor que no mandar nada.
 *
 * ⚠ Y NO ESCALA A SOPORTE. Pedir un tutorial no es un problema técnico: si
 *   fuera por `escalar`, cada «tienen videos?» le sonaría el WhatsApp al equipo
 *   para nada.
 *
 * Al lead se le manda la lista Y la prueba, en ese orden. Solo la lista sería
 * regalarle la respuesta y perder la venta; solo la prueba es no contestar lo
 * que preguntó.
 */
export const TUTORIALES = {
  lead: `Claro, tenemos los tutoriales en video, paso a paso:\n\n${EMPRESA.linkTutoriales}\n\nAhi va desde crear la cuenta hasta cuadrar la caja de la noche. Cada uno dura entre 2 y 5 minutos.\n\nY si quiere ir probando mientras los ve, son ${EMPRESA.diasPrueba} dias gratis sin tarjeta.`,

  registrado: `Claro, aqui estan todos los tutoriales en video:\n\n${EMPRESA.linkTutoriales}\n\nEstan en orden, desde lo basico hasta la caja. Si no encuentra el que necesita, escribale a soporte al ${EMPRESA.telefonoSoporte}.`,
}

export const RECHAZO = `Entendido, que este bien. Si en algun momento necesita una herramienta para manejar su cartera, aqui estamos.`

/* ⚠ «¿POR DÓNDE ENTRO?» SE CONTESTA CON EL ENLACE, NO CON UN VÍDEO.
 *
 * Es la pregunta número uno de los registrados —38 de 204 el 2 sep— y el dueño
 * lo dijo sin rodeos al ver el tutorial que le habíamos hecho: «eso se
 * solucionaba fácilmente enviándole el link de acceso con el respectivo
 * mensaje, es una pendejada». Quien pregunta dónde está la puerta quiere la
 * puerta, no setenta segundos de vídeo.
 *
 * Va aparte de ESCALAMIENTO porque no escala a nadie: no lleva teléfono ni
 * horario, lleva el enlace. Lo del vídeo va detrás y en una línea, porque
 * poner el icono sí hay que enseñarlo. */
export const ACCESO = `Entra por aquí:\n\n${EMPRESA.linkApp}\n\nCon el mismo correo y la clave con la que se registró. Sus clientes y su caja siguen ahí.\n\nY si quiere dejarla como icono en su celular, para no buscarla más: ${VIDEO_INSTALAR?.url || EMPRESA.linkTutoriales}`

export function respuestaEscalamiento(razon) {
  return ESCALAMIENTO[razon] || ESCALAMIENTO.pide_humano
}

/* ══ LA APERTURA DE UTILIDAD Y EL PITCH QUE VA DETRÁS ═════════════════════
 *
 * Desde el 7 sep 2026 el PRIMER mensaje a un lead es `solicitud_recibida`,
 * una plantilla de categoría UTILIDAD: confirma la solicitud y pide una
 * respuesta. No vende. Meta la entrega también a los números «en
 * experimento» (130472), que con las de marketing no recibían nada, y si la
 * persona contesta se abren 24 horas de conversación libre, sin plantilla.
 *
 * El pitch va AQUÍ, fijo, y no lo redacta el modelo: es el primer mensaje
 * que vende y tiene que salir igual siempre. Está hecho con lo que ya está
 * medido: `contacto_v2` («el sistema le calcula todo… cobradores en tiempo
 * real… pruébelo gratis») responde 64 % y registra 23,6 %, más que la
 * pregunta de dolor sola; y el dolor de «sumar a mano» convirtió 9,4× más
 * que la pregunta abierta (bot_ab_test_jul2026). Va de usted siempre, como
 * el resto del bot; solo nombra funciones de la lista real; y cierra con la
 * pregunta de la guía de ventas («¿cobra solo o tiene cobradores?») para
 * saber por dónde seguir. Desde el segundo turno sigue el modelo. */
/* Los textos EXACTOS aprobados en Meta. La v1 (id 975833722203405) tutea, que
   es como la escribió el dueño y como la aprobó Meta; la v2 (id
   2245222906262198) dice lo mismo de usted, que es como habla el resto del bot
   («mejor que no tutee», 8 sep 2026). Cuál sale lo decide
   `WA_TEMPLATE_PRIMER_CONTACTO`; aquí están las dos porque el historial que lee
   el modelo tiene que guardar la que de verdad se envió. */
export const APERTURAS_UTILITY = {
  solicitud_recibida: (nombre) => `Hola ${nombre}, recibimos tu solicitud en Control Finanzas. ¿Quieres que te contemos por aquí cómo funciona? Responde a este mensaje y te atendemos.`,
  solicitud_recibida_v2: (nombre) => `Hola ${nombre}, recibimos su solicitud en Control Finanzas. ¿Quiere que le contemos por aquí cómo funciona? Responda a este mensaje y le atendemos.`,
}
export const APERTURA_POR_DEFECTO = 'solicitud_recibida'

// Reconoce las dos, con y sin la marca del rescate delante.
export const APERTURA_UTILITY_CLAVE = /recibimos (?:tu|su) solicitud en control finanzas/i

export function esAperturaUtility(texto) {
  return APERTURA_UTILITY_CLAVE.test(String(texto || ''))
}

export function textoAperturaUtility(nombre, plantilla = APERTURA_POR_DEFECTO) {
  const arma = APERTURAS_UTILITY[plantilla] || APERTURAS_UTILITY[APERTURA_POR_DEFECTO]
  return arma(nombre)
}

/** Un solo mensaje del bot, y es la apertura de utilidad: el lead acaba de
 *  contestar por primera vez. */
export function esPrimerTurnoTrasApertura(historial = []) {
  const bots = (historial || []).filter((m) => m?.rol === 'bot')
  const leads = (historial || []).filter((m) => m?.rol === 'lead')
  return bots.length === 1 && esAperturaUtility(bots[0].texto) && leads.length <= 1
}

/* Lo que se contesta a «¿quieres que te contemos?» sin decir nada concreto:
   «sí», «claro», «cuénteme», «hola, cómo funciona», un pulgar. Ahí va el
   pitch fijo. Si el lead pregunta algo suyo («¿sirve para diario?», «tengo
   3 cobradores»), eso lo contesta el modelo, no un texto de memoria. */
const PALABRAS_GENERICAS = new Set(('hola buenas buenos dias tardes noches dia tarde noche hey ola holi que tal '
  + 'si claro dale ok okey listo bueno bien vale va de una hagale dele obvio perfecto excelente genial '
  + 'me interesa interesa interesado interesada quiero quisiera deseo necesito gustaria saber conocer '
  + 'mas informacion info informarme informeme cuenteme cuentame digame dime expliqueme explicame '
  + 'muestreme muestrame como funciona es se trata sobre acerca esto eso todo el la lo los las un una '
  + 'del al a y o pues por favor porfa porfavor gracias entonces ya aqui aca ahi sistema control finanzas '
  + 'usted ustedes tu su sus senor senora don dona amigo hermano jefe estoy soy muy mucho gusto '
  + 'claro que si que si ok si').split(/\s+/))

export function esRespuestaGenerica(texto) {
  const limpio = String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, ' ')
    .trim()
  if (!limpio) return true                 // un pulgar, un «👍», un «?»
  const palabras = limpio.split(/\s+/)
  if (palabras.length > 12) return false
  return palabras.every((w) => PALABRAS_GENERICAS.has(w))
}

function primerNombreLimpio(nombre) {
  const limpio = String(nombre || '').trim()
  if (!limpio || /\d|club|store|shop|tienda|empresa|negocio|prestamos|creditos|inversiones/i.test(limpio)) return ''
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return ''
  const p = partes[0]
  return p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()
}

export function pitchTrasSolicitud({ nombre, diasPrueba = 14 } = {}) {
  const n = primerNombreLimpio(nombre)
  const saludo = n ? `Claro, ${n}.` : 'Claro.'
  return `${saludo} Control Finanzas es un sistema donde usted registra el préstamo y el sistema le calcula todo: cuotas, intereses, la ganancia del día y la mora. Sin sumar a mano ni pelear con el cuaderno.

Usted abre desde su celular, computador o tablet y ve al segundo cuánto tiene en la calle, quién le pagó hoy y quién se atrasó. Y si tiene cobradores, cada uno entra con su propio usuario, registra el cobro en la puerta y usted lo ve en tiempo real, sin esperar a que llegue a cuadrar.

Lo puede probar gratis ${diasPrueba} días con su propia cartera y ver si le sirve.

¿Usted cobra solo o tiene cobradores?`
}
