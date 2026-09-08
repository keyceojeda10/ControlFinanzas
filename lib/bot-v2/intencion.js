// lib/bot-v2/intencion.js — El clasificador SEMÁNTICO de intención (BOT v3 · sprint 3).
//
// ══ QUÉ ES Y QUÉ NO ES ══════════════════════════════════════════════════════
//
// Las tres auditorías externas del 8 sep 2026 coincidieron: el fallo del bot no
// es el modelo que redacta, es el código que decide la etapa con listas de
// palabras. Cada mes aparecen dos formas nuevas de decir «cuánto cuesta» y se
// añade un regex; se llevaban listas de 15-20 palabras y seguían fallando con
// «q cuesta», «muy cara», «no pude iniciar». Esto ya no escala.
//
// Aquí un modelo pequeño LEE el mensaje con su contexto y devuelve UNA
// estructura cerrada: la intención, si es pregunta, si hay frustración, cuánta
// intención de compra. No redacta nada. El código sigue decidiendo qué hacer
// con eso (ver `etapaDesdeIntencion` en stages.js).
//
// ══ REGLAS DE ESTA PIEZA ════════════════════════════════════════════════════
//
// 1. El regex sigue delante para lo inequívoco: rechazo, humano, pago, soporte
//    duro, tutoriales. Eso no gasta modelo y no admite ambigüedad.
// 2. Solo se llama cuando el mensaje es de venta y ningún regex fuerte lo
//    resolvió (`necesitaSemantica`). Un «cuánto cuesta» no necesita modelo.
// 3. Si el modelo falla, tarda más de 4 s o devuelve basura, se devuelve null
//    y el árbol de siempre decide. Nunca deja al bot mudo.
// 4. Corre en A/B por lead (`BOT_INTENCION=ab`): mitad con semántica, mitad
//    sin. El reparto sale del id del lead, así que es estable y se puede medir
//    después contra registros. `on` y `off` fuerzan.
// 5. Todo lo que decide queda en la traza (`clasificacion`), para poder medir.

import Anthropic from '@anthropic-ai/sdk'

const anthropic = process.env.ANTHROPIC_API_KEY ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }) : null
const MODELO = 'claude-haiku-4-5-20251001'
const TIMEOUT_MS = 6000

export const INTENCIONES = [
  'precio',            // pregunta por precio, planes, cómo se paga
  'objecion',          // pega: caro, desconfianza, ya tengo otro, no me gusta
  'pregunta_producto', // qué hace, cómo funciona X, sirve para Y
  'dato_negocio',      // cuenta algo suyo: clientes, cobradores, cómo cobra
  'aclaracion',        // no entendió, pide que le expliquen, «más info», «y después»
  'confirmacion',      // sí, claro, ok, dale (sin más)
  'compra',            // quiere probar, pide el enlace, cómo se registra
  'soporte',           // no puede entrar, error, no le funciona
  'humano',            // quiere hablar con una persona o que lo llamen
  'rechazo',           // no le interesa, que no le escriban
  'tutoriales',        // pide vídeos o manual
  'saludo',            // solo saluda
  'otro',
]

const HERRAMIENTA = {
  name: 'interpretar_mensaje',
  description: 'Interpreta la intención del último mensaje del prospecto. No redactes respuesta.',
  input_schema: {
    type: 'object',
    properties: {
      intencion: { type: 'string', enum: INTENCIONES },
      es_pregunta: { type: 'boolean', description: 'true si el prospecto está preguntando o pidiendo que le expliquen algo, lleve o no signo de interrogación' },
      frustracion: { type: 'boolean', description: 'true si el prospecto suena molesto, ignorado o repite que no le contestan' },
      intencion_compra: { type: 'integer', description: 'De 0 a 100, cuánto se acerca a comprar en este mensaje' },
      confianza: { type: 'number', description: 'De 0 a 1, qué tan seguro estás de la intención' },
    },
    required: ['intencion', 'es_pregunta', 'frustracion', 'intencion_compra', 'confianza'],
  },
}

/* Lo que ya resuelve un regex con seguridad no necesita modelo. Espejo de los
   patrones fuertes de stages.js y del clasificador; si cambian allí, cambiar
   aquí. Lo que queda son los mensajes ambiguos: «Y después», «Todo», «No me
   gusta», «llevo 600 clientes», «Información». */
const FUERTE = /(?:cu[aá]nto|precio|costo|\bplan(?:es)?\b|mensual|(?:q|que|qu[eé]) (?:vale|cuesta|sale)|forma de pago|como (?:se )?paga|quiero (?:probar|registrarme|el link|la prueba)|mand[eé]me|env[ií]eme|d[eé]me el link|c[oó]mo me registro|^(?:ok|okey|listo|gracias|muchas gracias|dale|de una|perfecto|bueno|vale)[.!\s]*$)/i

export function necesitaSemantica(texto) {
  const t = String(texto || '').trim()
  if (t.length < 2) return false
  return !FUERTE.test(t)
}

/** A/B estable por lead: mismo lead, misma variante siempre. */
export function varianteDe(leadId, modo = process.env.BOT_INTENCION || 'off') {
  if (modo === 'on') return 'semantica'
  if (modo !== 'ab') return 'regex'
  let h = 0
  for (const ch of String(leadId || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return h % 2 === 0 ? 'semantica' : 'regex'
}

/** Puro: valida lo que devolvió el modelo. Basura → null. */
export function interpretar(input) {
  if (!input || typeof input !== 'object') return null
  if (!INTENCIONES.includes(input.intencion)) return null
  const confianza = Number(input.confianza)
  if (!(confianza >= 0 && confianza <= 1)) return null
  return {
    intencion: input.intencion,
    esPregunta: Boolean(input.es_pregunta),
    frustracion: Boolean(input.frustracion),
    intencionCompra: Math.max(0, Math.min(100, Number(input.intencion_compra) || 0)),
    confianza,
  }
}

function promptDe({ texto, ultimoBot, ultimoLead, linkEnviado, registrado }) {
  return `Eres el intérprete de un bot de ventas por WhatsApp de Control Finanzas, un sistema de cartera y cobros para prestamistas de Colombia. Tu única tarea es decir QUÉ QUIERE el prospecto con su último mensaje. No respondas al prospecto.

Contexto:
- Lo último que dijo el bot: ${ultimoBot ? `"${String(ultimoBot).slice(0, 300)}"` : '(nada todavía)'}
- Lo anterior que dijo el prospecto: ${ultimoLead ? `"${String(ultimoLead).slice(0, 200)}"` : '(nada)'}
- ¿Ya se le mandó el enlace de registro? ${linkEnviado ? 'sí' : 'no'}
- ¿Ya está registrado en el sistema? ${registrado ? 'sí' : 'no'}

Pistas de cómo habla esta gente: escriben sin tildes ni signos de pregunta, con abreviaturas («q cuesta», «xq»), y con expresiones colombianas («de una», «hágale», «listo pues» son un sí). «Manual» o «libreta» a secas suelen ser la RESPUESTA a «¿cómo lleva su cartera?», no una petición de manual. Un «sí» después de una pregunta del bot es una respuesta a esa pregunta, no una compra, salvo que el bot acabe de ofrecer la prueba o el enlace. «Más información», «y después», «todo», «por favor» a secas son peticiones de que le expliquen. Contar cuántos clientes o cobradores tiene es un dato del negocio, no una pregunta. «Rechazo» es SOLO cuando pide que no le escriban o dice que no le interesa; un «no» a secas o «no me gusta» es una respuesta u objeción, no un rechazo. «Tutoriales» es SOLO cuando PIDE vídeos o manual; si dice que ya los está viendo o ya los vio, no lo es.

Mensaje del prospecto ahora:
"${String(texto).slice(0, 500)}"`
}

/**
 * Llama al modelo. Devuelve la interpretación o null si no se pudo.
 * @returns {Promise<{intencion,esPregunta,frustracion,intencionCompra,confianza,latenciaMs}|null>}
 */
export async function clasificarIntencion(ctx) {
  if (!anthropic) return null
  const t0 = Date.now()
  try {
    const resp = await anthropic.messages.create({
      model: MODELO,
      /* ⚠ 120 TOKENS SE QUEDABAN CORTOS. Medido el 8 sep: 4 de 12 mensajes
         volvían con `stop_reason: max_tokens` y el JSON cortado antes de
         `confianza`, así que la validación los tiraba. Y eran justo los
         buenos: «Excel» y «Yo misma cobro» como dato_negocio. */
      max_tokens: 300,
      system: [{ type: 'text', text: promptDe(ctx), cache_control: { type: 'ephemeral' } }],
      tools: [HERRAMIENTA],
      tool_choice: { type: 'tool', name: HERRAMIENTA.name },
      messages: [{ role: 'user', content: 'Interpreta el mensaje con la herramienta.' }],
    }, { timeout: TIMEOUT_MS, maxRetries: 0 })
    const uso = (resp.content || []).find((b) => b.type === 'tool_use')
    if (resp.stop_reason === 'max_tokens') console.warn('[Bot v3 intención] respuesta cortada por max_tokens')
    const r = interpretar(uso?.input)
    return r ? { ...r, latenciaMs: Date.now() - t0, tokensIn: resp.usage?.input_tokens || 0, tokensOut: resp.usage?.output_tokens || 0 } : null
  } catch (e) {
    console.warn('[Bot v3 intención] falló, decide el regex:', e?.status || '', e?.name || '', String(e.message).slice(0, 120))
    return null
  }
}
