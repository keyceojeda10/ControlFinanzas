// lib/bot-v2/clasificador.js — Clasifica el mensaje entrante ANTES de llamar al AI.
// Decide: ventas, soporte (escalar), spam, o ignorar.
// Determinístico. Sin AI. Rapido.

const PAGO_KEYWORDS = [
  'como pago', 'cómo pago', 'quiero pagar', 'activar plan', 'activar mi plan',
  'se me acabo', 'se me acabó', 'se me vencio', 'se me venció', 'vencio mi prueba',
  'venció mi prueba', 'quiero seguir', 'renovar', 'como contrato', 'cómo contrato',
  'metodo de pago', 'método de pago', 'donde pago', 'dónde pago', 'precio del plan',
  'quiero comprar', 'quiero adquirir', 'pagar la suscripcion', 'pagar la suscripción',
]

const SOPORTE_KEYWORDS = [
  'no me deja', 'no me funciona', 'no puedo', 'error', 'se traba', 'no carga',
  'no abre', 'se cierra', 'pantalla blanca', 'no aparece', 'bug', 'fallo',
  'no me sale', 'problema tecnico', 'problema técnico', 'soporte',
  'no lo supe usar', 'no sé usarlo', 'no se usarlo', 'no entiendo',
  'como lo uso', 'cómo lo uso', 'como se usa', 'cómo se usa',
  'como hago', 'cómo hago', 'no puedo entrar', 'no me deja entrar',
  'se me olvido la contraseña', 'olvidé mi contraseña', 'contraseña',
  'no me llega el correo',
]

const HUMANO_KEYWORDS = [
  'hablar con alguien', 'hablar con una persona', 'quiero hablar con',
  'paseme con', 'paseme a', 'un asesor', 'una asesora', 'atencion humana',
  'persona real', 'hablar con persona', 'con un humano',
]

const RECHAZO_KEYWORDS = [
  'no me interesa', 'no gracias', 'dejeme en paz', 'no me escriba',
  'no llame mas', 'no quiero', 'dejen de escribir', 'no molestar',
  'basta', 'bloquear',
]

const SALUDO_BASICO = /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|hey|ey|que\s*tal|qu[eé]\s*tal)[.!,?\s]*$/i

const AUTO_MESSAGES = [
  /gracias por (?:comunicarse|contactar|escribir)/i,
  /en (?:este |estos )?momentos? no (?:estamos|podemos)/i,
  /fuera de (?:nuestro )?horario/i,
  /le (?:responderemos|contestaremos|atenderemos) (?:a la )?(?:brevedad|pronto)/i,
  /respuesta autom[aá]tica/i,
  /mensaje autom[aá]tico/i,
  /bienvenid[oa] a (?:mi |nuestro )?negocio/i,
]

export function clasificar(texto, { yaRegistrado = false } = {}) {
  const t = (texto || '').toLowerCase().trim()
  if (!t) return { tipo: 'ignorar', razon: 'vacio' }

  // Mensajes automaticos de otros negocios
  if (AUTO_MESSAGES.some(rx => rx.test(t))) {
    return { tipo: 'ignorar', razon: 'mensaje_automatico' }
  }

  // Rechazo explicito
  if (RECHAZO_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'rechazo', razon: 'rechazo_explicito' }
  }

  // Pide hablar con humano
  if (HUMANO_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'pide_humano' }
  }

  // Intencion de pago (especialmente si ya esta registrado)
  if (PAGO_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'intencion_pago' }
  }

  // Soporte tecnico (SIEMPRE escalar si ya esta registrado)
  if (yaRegistrado && SOPORTE_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'soporte_registrado' }
  }

  // Si no esta registrado y pide soporte, aun asi escalar
  if (SOPORTE_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'soporte' }
  }

  return { tipo: 'ventas', razon: null }
}

export function esSaludoBasico(texto) {
  return SALUDO_BASICO.test((texto || '').trim())
}

export { PAGO_KEYWORDS }
