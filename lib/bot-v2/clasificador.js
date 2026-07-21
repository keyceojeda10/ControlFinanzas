// lib/bot-v2/clasificador.js — Clasifica el mensaje entrante ANTES de llamar al AI.
// Decide: ventas, soporte (escalar), spam, o ignorar.
// Determinístico. Sin AI. Rapido.

const PAGO_KEYWORDS = [
  'como pago', 'cómo pago', 'quiero pagar', 'activar plan', 'activar mi plan',
  'se me acabo', 'se me acabó', 'se me vencio', 'se me venció', 'vencio mi prueba',
  'venció mi prueba', 'quiero seguir', 'renovar', 'como contrato', 'cómo contrato',
  'metodo de pago', 'método de pago', 'donde pago', 'dónde pago',
  'quiero comprar', 'quiero adquirir', 'pagar la suscripcion', 'pagar la suscripción',
]

// Soporte duro: siempre escalar, registrado o no (problemas tecnicos reales)
const SOPORTE_HARD = [
  'no me funciona', 'error', 'se traba', 'no carga',
  'no abre', 'se cierra', 'pantalla blanca', 'bug', 'fallo',
  'no me sale', 'problema tecnico', 'problema técnico', 'soporte',
  'no puedo entrar', 'no me deja entrar',
  'se me olvido la contraseña', 'olvidé mi contraseña',
  'no me llega el correo',
  'no pude instalar', 'no sé cómo es instalar', 'no se como instalar',
  'no me lo permite', 'no lo permite',
  'no pude registrar', 'no me registr', 'no pude entrar',
  'saldo negativo', 'saldo en negativo', 'aparece negativo',
  'cuadrar caja', 'arqueo', 'ajuste de caja',
]

// Soporte suave: solo escalar si ya esta registrado (para no-registrados son preguntas de preventa)
const SOPORTE_SOFT = [
  'no me deja', 'no puedo', 'no aparece',
  'no lo supe usar', 'no sé usarlo', 'no se usarlo', 'no entiendo',
  'como lo uso', 'cómo lo uso', 'como se usa', 'cómo se usa',
  'como hago', 'cómo hago', 'contraseña',
  'no lo pude', 'no he podido', 'no permite',
  'como quito', 'cómo quito', 'como borro', 'cómo borro',
  'como cambio', 'cómo cambio', 'como elimino', 'cómo elimino',
  'como renuevo', 'cómo renuevo', 'como registro', 'cómo registro',
]

const HUMANO_KEYWORDS = [
  'hablar con alguien', 'hablar con una persona', 'quiero hablar con',
  'paseme con', 'paseme a', 'un asesor', 'una asesora', 'atencion humana',
  'persona real', 'hablar con persona', 'con un humano',
]

// Solo frases claras de opt-out, con limites de palabra. Antes se usaba
// includes() con "basta" y "no quiero", que daba falsos positivos graves:
// "bastantes clientes" -> basta, "no quiero mensual" (objecion) -> rechazo,
// "puedo bloquear un cliente?" (funcion) -> rechazo. Ahora es regex acotada.
const RECHAZO_REGEX = /(^|[^a-záéíóúñ])(no me interesa|ya no me interesa|no,? gracias|d[eé]jenme? en paz|no me escriba(?: m[aá]s)?|no me contacte|no me vuelvan? a escribir|no me manden? m[aá]s mensajes|no llame[nm]? m[aá]s|dejen de escribir(?:me)?|no (?:me )?molest(?:e|en|ar)|quit(?:e|en) mi n[uú]mero|no quiero (?:saber )?nada)([^a-záéíóúñ]|$)/i

const SALUDO_BASICO = /^(hola|buenos?\s*d[ií]as?|buenas?\s*tardes?|buenas?\s*noches?|hey|ey|que\s*tal|qu[eé]\s*tal)[.!,?\s]*$/i

const AUTO_MESSAGES = [
  /gracias por (?:comunicarse|contactar|escribir)/i,
  /en (?:este |estos )?momentos? no (?:estamos|podemos)/i,
  /fuera de (?:nuestro )?horario/i,
  /le (?:responderemos|contestaremos|atenderemos) (?:a la )?(?:brevedad|pronto)/i,
  /respuesta autom[aá]tica/i,
  /mensaje autom[aá]tico/i,
  /bienvenid[oa] a (?:mi |nuestro )?negocio/i,
  /cat[aá]logo.*https?:\/\//i,
  /https?:\/\/.*cat[aá]logo/i,
  /(?:visita|conoce|mira) (?:mi|nuestro) (?:cat[aá]logo|negocio|tienda)/i,
  /(?:tenemos|ofrecemos|vendemos)[\s\S]{0,80}https?:\/\//i,
  /https?:\/\/(?:wa\.me\/c|bit\.ly|api\.whatsapp\.com\/send)/i,
]

export function clasificar(texto, { yaRegistrado = false } = {}) {
  const t = (texto || '').toLowerCase().trim()
  if (!t) return { tipo: 'ignorar', razon: 'vacio' }

  // Mensajes automaticos de otros negocios
  if (AUTO_MESSAGES.some(rx => rx.test(t))) {
    return { tipo: 'ignorar', razon: 'mensaje_automatico' }
  }

  // Rechazo explicito. Para clientes YA REGISTRADOS nunca disparamos la
  // despedida dura: su "no" casi siempre es sobre un plan o funcion, no sobre
  // dejar de usar el sistema. Se deja pasar a 'ventas' y el stage POST_LINK
  // lo atiende como pregunta. (Bug real: a un cliente que pregunto "quiero
  // retirar plata de la caja" se le mando la despedida de RECHAZO.)
  if (!yaRegistrado && RECHAZO_REGEX.test(t)) {
    return { tipo: 'rechazo', razon: 'rechazo_explicito' }
  }

  // Pide hablar con humano
  if (HUMANO_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'pide_humano' }
  }

  // Intencion de pago: siempre escalar (registrado o no, estos son intent de compra real)
  if (PAGO_KEYWORDS.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'intencion_pago' }
  }

  // Preguntas de precio preventa: NO escalar, dejar que el stage PRECIOS las maneje
  // (el regex de PRECIOS en detectarStage atrapa "precio", "cuanto vale", etc.)
  // Solo escalar si ya esta registrado y pregunta cosas como "precio del plan"
  if (yaRegistrado && /precio del plan|cu[aá]nto (?:cuesta|vale|sale) (?:el |mi )?plan/i.test(t)) {
    return { tipo: 'escalar', razon: 'intencion_pago' }
  }

  // Soporte tecnico duro: escalar siempre (problemas tecnicos claros)
  if (SOPORTE_HARD.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: yaRegistrado ? 'soporte_registrado' : 'soporte' }
  }

  // Soporte suave: solo escalar si ya esta registrado
  // Para no-registrados, "como hago", "como se usa" etc. son preguntas de preventa
  if (yaRegistrado && SOPORTE_SOFT.some(k => t.includes(k))) {
    return { tipo: 'escalar', razon: 'soporte_registrado' }
  }

  return { tipo: 'ventas', razon: null }
}

export function esSaludoBasico(texto) {
  return SALUDO_BASICO.test((texto || '').trim())
}

export { PAGO_KEYWORDS }
