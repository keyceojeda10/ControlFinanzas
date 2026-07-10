// lib/bot-v2/respuestas-fijas.js — Respuestas deterministicas para situaciones comunes.
// Si el clasificador decide escalar o rechazar, la respuesta viene de aqui, no del AI.

import { EMPRESA } from './producto.js'

export const ESCALAMIENTO = {
  pide_humano: `Claro, ya le paso su caso a nuestro equipo.\n\nPuede escribir directo al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte}.`,

  intencion_pago: `Para activar su plan, puede escribir directo a nuestro equipo al ${EMPRESA.telefonoSoporte} y ellos le ayudan con todo el proceso.\n\nLo atienden de ${EMPRESA.horarioSoporte}.`,

  soporte: `Para ayudarle con eso, lo mejor es que hable con nuestro equipo de soporte.\n\nEscribales al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte} y le resuelven en vivo.`,

  soporte_registrado: `Entiendo, para resolverle eso rapido lo mejor es que hable directo con soporte.\n\nEscribales al ${EMPRESA.telefonoSoporte}, lo atienden de ${EMPRESA.horarioSoporte} y le ayudan paso a paso.`,
}

export const RECHAZO = `Entendido, que este bien. Si en algun momento necesita una herramienta para manejar su cartera, aqui estamos.`

export function respuestaEscalamiento(razon) {
  return ESCALAMIENTO[razon] || ESCALAMIENTO.pide_humano
}
