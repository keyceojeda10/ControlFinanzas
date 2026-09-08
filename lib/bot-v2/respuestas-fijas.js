// lib/bot-v2/respuestas-fijas.js — Respuestas deterministicas para situaciones comunes.
// Si el clasificador decide escalar o rechazar, la respuesta viene de aqui, no del AI.

import { EMPRESA } from './producto.js'

export const ESCALAMIENTO = {
  pide_humano: `Claro, ya le paso su caso a nuestro equipo.\n\nPuede escribir directo al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte}.`,

  intencion_pago: `Para activar su plan, puede escribir directo a nuestro equipo al ${EMPRESA.telefonoSoporte} y ellos le ayudan con todo el proceso.\n\nLo atienden de ${EMPRESA.horarioSoporte}.`,

  soporte: `Para ayudarle con eso, lo mejor es que hable con nuestro equipo de soporte.\n\nEscribales al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte} y le resuelven en vivo.`,

  soporte_registrado: `Entiendo, para resolverle eso rapido lo mejor es que hable directo con soporte.\n\nEscribales al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte} y le ayudan paso a paso.`,
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
export const APERTURA_UTILITY_CLAVE = 'recibimos tu solicitud en control finanzas'

export function esAperturaUtility(texto) {
  return String(texto || '').toLowerCase().includes(APERTURA_UTILITY_CLAVE)
}

/** El texto EXACTO aprobado en Meta para `solicitud_recibida` (id 975833722203405). */
export function textoAperturaUtility(nombre) {
  return `Hola ${nombre}, recibimos tu solicitud en Control Finanzas. ¿Quieres que te contemos por aquí cómo funciona? Responde a este mensaje y te atendemos.`
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
