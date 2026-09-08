// lib/bot-v2/validador.js — EL VALIDADOR (BOT v3 · sprint 7). Módulo puro.
//
// ══ POR QUÉ EXISTE ══════════════════════════════════════════════════════════
//
// El sanitizador es un firewall con tijera: borra oraciones enteras y a veces
// deja un mensaje cojo («Lucas es la que responde sobre su negocio»). Y la
// segunda pasada solo miraba dos cosas (calco largo, despedida con dudas).
//
// Las tres auditorías del 8 sep 2026 pidieron lo mismo: validar la respuesta
// ANTES de mandarla, con motivos estructurados, y regenerar con esos motivos
// delante en vez de borrar a ciegas. Esto es eso. Devuelve `{ ok, motivos }`;
// `agente.js` decide qué hacer con cada motivo (regenerar, arreglar a mano, o
// mandar el mejor de los dos intentos).
//
// ══ DOS CLASES DE MOTIVO ════════════════════════════════════════════════════
//
// DUROS: no pueden salir. Precio falso, función inexistente, procedimiento de
//        dinero, link donde no toca, nombre propio. Si tras regenerar siguen,
//        el sanitizador los recorta a la fuerza (última red, no la primera).
// BLANDOS: hacen que el bot suene a bot. Argumento repetido, pregunta repetida,
//        despedida con dudas abiertas, sin siguiente paso, demasiado largo,
//        tuteo. Se regenera una vez; si vuelven, se manda el intento con menos.

import { funcionesMencionadas, FUNCIONES, NO_EXISTE, PLANES, EXTRAS } from './kb.js'
import { PRECIOS_PAIS } from '@/lib/planes'
import { esCalcoLargo, esDespedida, tieneDudasAbiertas, normalizar } from './anti-repeticion.js'

export const DUROS = new Set(['precio_falso', 'funcion_inexistente', 'procedimiento', 'link_no_permitido', 'nombre_propio', 'cobro_automatico'])

// Los precios que SÍ existen para el país del lead (Colombia si no se sabe):
// mensual, trimestral (×3 con 10 %) y anual (×10). Mezclar los 19 países hacía
// el cedazo inútil: $45.000 «existía» porque Costa Rica tiene un plan a 4.500.
function preciosRealesDe(pais) {
  const c = PRECIOS_PAIS[String(pais || 'co').toLowerCase()] || PRECIOS_PAIS.co
  const base = pais && c !== PRECIOS_PAIS.co ? [c.starter, c.basic, c.growth, c.standard, c.professional, c.cobradorExtra, c.rutaExtra]
    : [...PLANES.map((p) => p.precio), EXTRAS.cobradorExtra, EXTRAS.rutaExtra]
  return new Set(base.filter(Boolean).flatMap((p) => [p, p * 10, Math.round(p * 2.7)]))
}
const sinTildes = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const RX_BLACKLIST = new RegExp(NO_EXISTE.map((s) => sinTildes(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i')
const RX_NOMBRE = /\b(?:soy|me llamo|mi nombre es|le habla|le escribe)\s+(?:Daniela|Carlos|Lucas|Maria|María|Andrea|Sofia|Sofía|Juan|Pedro|Santiago|Camilo|Valentina|Laura|Diana|Paola|Angela|Ángela|Natalia|Monica|Mónica)\b/i
const RX_PROCEDIMIENTO = /\b(?:egreso|ingreso)\b[^.\n]{0,40}\b(?:caja|saldo)\b|\bajuste\s+de\s+caja\b|\bse\s+calcula\b[^.\n]{0,40}\b(?:inter[eé]s|intereses|cuota|mora)\b|\b(?:vaya|entre|ingrese|toque|pulse|haga\s+clic|d[eé]\s+clic|seleccione)\s+(?:a|en|la|el)\s+(?:men[uú]|pesta[ñn]a|bot[oó]n|opci[oó]n|secci[oó]n|pantalla)/i
const RX_COBRO_AUTO = /\bse\s+d[eé]bit[ao]\b|\b(?:cobro|pago|d[eé]bito)\b[^.\n]{0,30}\bautom[aá]tic[oa]\b|\bautom[aá]tic\w*[^.\n]{0,40}\b(?:cuenta\s+bancaria|tarjeta|banco)\b/i
const RX_LINK = /https?:\/\/app\.control-finanzas\.com\/registro\S*/i
const RX_CIERRE_PASIVO = /(?:quedo atent[oa]|cualquier cosa me (?:avisa|escribe)|me cuenta cuando quiera|aqui estoy si necesita|que le vaya bien)[.!\s]*$/i
const RX_TUTEO = /\b(?:t[uú]\s+\w|tienes|puedes|quieres|necesitas|m[aá]ndame|escr[ií]beme|dame(?!\s+su)|tu(?:s)?\s+(?:negocio|plata|dinero|clientes?|cuenta|cartera))\b/i
/* El lead PIDE que le desarrollen algo: una pregunta, o decir que no entiende.
   Ahí volver sobre el mismo argumento no es repetirse, es contestar. Sin esta
   excepción, «¿y cómo hago para ver lo que cobran ellos?» tras hablar de ver
   los cobros al segundo se marcaba como argumento repetido, y la respuesta
   regenerada decía lo mismo: una llamada tirada. */
const LEAD_PREGUNTA = /\?|(?:^|\s)(?:como|c[oó]mo|cual|cu[aá]l|que|qu[eé]|cuanto|cu[aá]nto|cuando|cu[aá]ndo|donde|d[oó]nde|quien|qui[eé]n|por que|por qu[eé])\s|\b(?:no entiendo|no me queda claro|no comprendo|expl[ií]que|explicame|expl[ií]came|me explica|puede explicar|a que se refiere|como as[ií])\b/i

const LEAD_TUTEA = /(?<![a-zñáéíóú])(?:t[uú]|tienes|puedes|quieres|necesitas|m[aá]ndame|escr[ií]beme|dame)(?![a-zñáéíóú])/i

/**
 * @param {string} mensaje  lo que el modelo escribió (ya sanitizado)
 * @param {object} ctx      { textoLead, contexto, stage, historial, linkPermitido }
 */
export function validar(mensaje, { textoLead = '', contexto = null, stage = null, historial = [], linkPermitido = true, pais = null } = {}) {
  const m = String(mensaje || '')
  const motivos = []
  const numLead = String(textoLead || '').replace(/\D/g, '')
  const reales = preciosRealesDe(pais)

  // ── duros ──
  for (const p of m.match(/\$\s?([\d.]+)/g) || []) {
    const n = parseInt(p.replace(/[$.\s]/g, ''), 10)
    if (n >= 1000 && !reales.has(n) && !numLead.includes(String(n))) { motivos.push('precio_falso'); break }
  }
  if (RX_BLACKLIST.test(sinTildes(m))) motivos.push('funcion_inexistente')
  if (RX_PROCEDIMIENTO.test(m)) motivos.push('procedimiento')
  if (RX_NOMBRE.test(m)) motivos.push('nombre_propio')
  if (RX_COBRO_AUTO.test(m)) motivos.push('cobro_automatico')
  if (!linkPermitido && RX_LINK.test(m)) motivos.push('link_no_permitido')

  // ── blandos ──
  const usados = new Set(contexto?.argumentosUsados || [])
  const dichos = funcionesMencionadas(m).filter((id) => id !== 'prueba')
  const palabras = normalizar(m).split(' ').length
  if (dichos.length && dichos.every((id) => usados.has(id)) && palabras > 12
      && !LEAD_PREGUNTA.test(textoLead)
      && !dichos.some((id) => funcionesMencionadas(textoLead).includes(id))) motivos.push('argumento_repetido')
  if (contexto?.ultimaPreguntaBot) {
    const q = normalizar(contexto.ultimaPreguntaBot)
    if (q.split(' ').length >= 3 && normalizar(m).includes(q)) motivos.push('pregunta_repetida')
  }
  if (esCalcoLargo(m, historial)) motivos.push('calco_largo')
  if (tieneDudasAbiertas(textoLead) && esDespedida(m)) motivos.push('despedida_con_dudas')
  if (['VALOR', 'DESCUBRIMIENTO', 'OBJECION'].includes(stage) && !m.includes('?') && !RX_LINK.test(m) && RX_CIERRE_PASIVO.test(m.trim())) motivos.push('sin_siguiente_paso')
  if (m.length > 900) motivos.push('demasiado_largo')
  if (RX_TUTEO.test(m) && !LEAD_TUTEA.test(textoLead)) motivos.push('tuteo')

  return { ok: motivos.length === 0, motivos, duros: motivos.filter((x) => DUROS.has(x)) }
}

/** El texto que se le pone al modelo para que lo arregle. Uno por motivo, concreto. */
export function correccionPara(motivos, { contexto, textoLead } = {}) {
  /* Decirle «usa otro argumento» no sirve si no sabe cuáles le quedan: medido
     en producción el 8 sep, un lead con 60 cartulinas recibió cuatro mensajes
     seguidos con el mismo argumento y la regeneración devolvió lo mismo. Aquí
     se le pasan los que NO ha usado, con su texto exacto de la KB. */
  const usados = new Set(contexto?.argumentosUsados || [])
  const libres = FUNCIONES.filter((f) => !usados.has(f.id) && f.id !== 'prueba').slice(0, 10).map((f) => f.texto)
  const L = {
    precio_falso: 'Escribiste un precio que NO existe. Usa SOLO los precios exactos que están en el prompt, o no digas cifra.',
    funcion_inexistente: 'Nombraste algo que el sistema NO tiene. Quítalo; solo puedes nombrar las FUNCIONES REALES de la lista.',
    procedimiento: 'Explicaste un PROCEDIMIENTO de dentro del sistema (cómo se hace algo con plata). Eso no: di QUE el sistema lo hace y remite a soporte para el paso a paso.',
    nombre_propio: 'Te presentaste con un nombre propio. Eres el asistente de Control Finanzas, sin nombre.',
    cobro_automatico: 'Prometiste cobro o débito automático. NO existe: el prestamista paga cuando quiere desde la sección de planes.',
    link_no_permitido: 'Pusiste el link de registro y en este punto NO toca: responde a lo que dijo, sin link.',
    argumento_repetido: `Repetiste un argumento que YA usaste (${[...usados].join(', ') || 'ninguno registrado'}). Elige UNO de estos, el que mejor encaje con lo que el lead acaba de decir, y NO vuelvas sobre el anterior:\n${libres.map((t) => `  · ${t}`).join('\n')}`,
    pregunta_repetida: `Repetiste tu pregunta anterior («${contexto?.ultimaPreguntaBot || ''}»). El lead ya la contestó: avanza con lo que dijo y haz OTRA pregunta o aporta valor.`,
    calco_largo: 'Escribiste casi lo mismo que ya mandaste. El lead ya lo leyó. Di algo DISTINTO y concreto que responda a su último mensaje.',
    despedida_con_dudas: `El lead acaba de decir que tiene dudas o que no entiende («${String(textoLead || '').slice(0, 100)}»). NO te despidas: pregúntale QUÉ no le quedó claro o explícale lo concreto.`,
    sin_siguiente_paso: 'Cerraste con un «quedo atento» pasivo. Termina con una pregunta corta o un siguiente paso concreto.',
    demasiado_largo: 'Demasiado largo. Máximo 4 líneas cortas, una idea por mensaje.',
    tuteo: 'Tuteaste y el lead no tutea. Trátalo de usted.',
  }
  return motivos.map((k) => `- ${L[k] || k}`).join('\n')
}

/* Vivía en `agente.js`, que arrastra Prisma y no se puede importar desde una
   prueba pura ni desde un guion de medición. Es política del link, así que su
   sitio es este, al lado de `linkPermitidoEn`. */
export function leadPideLink(texto) {
  const t = (texto || '').toLowerCase()
  if (/(?:mand|env[ií]|pas|comp[aá]rt)[aeiouáéíóú]*(?:me(?:lo)?|nos)\s*(?:el |un |de nuevo |otra vez )?(?:link|enlace|url|click)/i.test(t)) return true
  if (/me\s+(?:puede|puedes?)\s+(?:mandar|enviar|pasar)\s+(?:el\s+)?(?:link|enlace|click)/i.test(t)) return true
  if (/(?:link|enlace)\s+(?:otra vez|de nuevo|nuevamente)/i.test(t)) return true
  if (/(?:d[oó]nde|c[oó]mo)\s+(?:me\s+)?(?:registro|inscribo)/i.test(t)) return true
  if (/(?:quiero\s+registrarme|me\s+quiero\s+registrar)/i.test(t)) return true
  if (/(?:mand[aáe]me(?:lo)?|env[ií]ame(?:lo)?|p[aá]same(?:lo)?)\s*(?:el\s+)?(?:de nuevo\s+)?(?:link|enlace|click)?/i.test(t)) return true
  if (/(?:donde|dónde)\s+(?:est[aá]|queda)\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/necesit[oa]\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/(?:d[ae]me|deme)\s+(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/(?:quiero|necesito)\s+(?:el\s+)?(?:link|enlace|entrar|acceder|ingresar)/i.test(t)) return true
  if (/(?:c[oó]mo|donde|dónde)\s+(?:entro|ingreso|accedo|abro)\s+(?:el |la |al )?(?:sistema|app|aplicaci[oó]n|plataforma)/i.test(t)) return true
  if (/(?:link|enlace|url)\s+(?:del |de la |para (?:entrar|acceder|ingresar))/i.test(t)) return true
  if (/(?:no\s+(?:tengo|encuentro|veo)\s+(?:el\s+)?(?:link|enlace))/i.test(t)) return true
  if (/cu[aá]l\s+(?:es\s+)?(?:el\s+)?(?:link|enlace)/i.test(t)) return true
  if (/se\s+me\s+(?:perdi[oó]|borr[oó]|olvid[oó]).*(?:link|enlace)/i.test(t)) return true
  // Mensajes cortos donde "link" o "enlace" es la palabra clave (ej: "El link", "link", "el enlace")
  if (/^\s*(?:el\s+)?(?:link|enlace|url)\s*[.!?]?\s*$/i.test(t)) return true
  return false
}

/* ══ EL LINK ES UNA ACCIÓN QUE EL CÓDIGO AUTORIZA (BOT v3 · sprint 6) ═════════
   No una etapa ni un reflejo del modelo. Se permite en cierre y precios, y
   siempre que el lead lo pida; se deniega en saludo, descubrimiento, valor y
   objeción, que son justo los sitios donde las auditorías midieron «link
   demasiado pronto». Al registrado nunca se le manda el de registro. */
export function linkPermitidoEn({ stage, leadPideLink = false, yaRegistrado = false, intencion = null }) {
  if (yaRegistrado) return false
  if (leadPideLink) return true
  if (intencion?.intencion === 'compra' && (intencion?.confianza ?? 0) >= 0.7) return true
  return ['CIERRE', 'PRECIOS', 'POST_LINK'].includes(stage)
}
