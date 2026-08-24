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
