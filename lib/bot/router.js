// lib/bot/router.js — Router determinístico (no IA) que clasifica qué agente usar
// Decide en base a: estado del lead, keywords del mensaje, historial reciente.
// Cero latencia, cero tokens, cero errores de clasificación.

const KEYWORDS_ESCALAMIENTO = [
  'persona', 'humano', 'asesor', 'llamada', 'videollamada',
  'hablar con alguien', 'hablar con una persona', 'quiero hablar',
  'atencion humana', 'persona real',
]

const KEYWORDS_SOPORTE = [
  'no puedo', 'no me deja', 'error', 'no funciona', 'no me funciona',
  'contrasena', 'codigo', 'problema', 'no entra', 'no carga',
  'no se puede', 'se traba', 'no aparece', 'no me aparece',
  'se quedo', 'pantalla blanca', 'no abre', 'se cierra',
  'no me llega', 'como hago', 'explicame', 'no se como',
  'como se hace', 'ayudame', 'como registro', 'como creo',
  'como elimino', 'como edito', 'como cambio',
]

const KEYWORDS_PAGO = [
  'quiero pagar', 'como pago', 'activar plan', 'se me acabo',
  'se vencio', 'se me vencio', 'vencio mi prueba', 'vencio la prueba',
  'como contrato', 'como sigo',
  'quiero el plan', 'quiero seguir', 'renovar',
]

// Estado del lead indica que ya se registró
const ESTADOS_REGISTRADO = [
  'registrado', 'registrado_demo',
]

/**
 * Clasifica qué agente debe atender este mensaje.
 * @param {Object} params
 * @param {string} params.mensaje - Texto del mensaje entrante
 * @param {string} params.estadoRegistro - Estado de registro (de cruce con User)
 * @param {string} params.estadoLead - Estado del BotLead
 * @param {Array}  params.historial - Últimos mensajes de la conversación
 * @returns {'ventas' | 'soporte' | 'cliente' | 'escalamiento'}
 */
function quitarAcentos(s) {
  return s.replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
}

export function clasificar({ mensaje, estadoRegistro, estadoLead, historial = [] }) {
  const txt = quitarAcentos((mensaje || '').toLowerCase())

  // 1. Escalamiento explícito — siempre tiene prioridad
  if (KEYWORDS_ESCALAMIENTO.some(k => txt.includes(k))) {
    return 'escalamiento'
  }

  // 2. Cliente ya registrado
  const yaRegistrado = (estadoRegistro || '').startsWith('registrado')
    || ESTADOS_REGISTRADO.some(e => (estadoLead || '').startsWith(e))

  if (yaRegistrado) {
    // Si quiere pagar, es escalamiento (humano maneja pagos)
    if (KEYWORDS_PAGO.some(k => txt.includes(k))) {
      return 'escalamiento'
    }
    // Si tiene problema técnico o pregunta cómo hacer algo
    if (KEYWORDS_SOPORTE.some(k => txt.includes(k))) {
      return 'cliente' // el agente cliente maneja soporte para registrados
    }
    return 'cliente'
  }

  // 3. Lead NO registrado con problema técnico
  if (KEYWORDS_SOPORTE.some(k => txt.includes(k))) {
    // Distinguir: si nunca se registró y pregunta "como hago" es probable venta
    // Pero si dice "no puedo", "error", "no funciona" es soporte real
    const esSoporteReal = [
      'no puedo', 'no me deja', 'error', 'no funciona', 'no me funciona', 'no entra',
      'no carga', 'no abre', 'no aparece', 'pantalla blanca', 'se cierra',
      'no me llega', 'se traba', 'se quedo',
    ].some(k => txt.includes(k))

    if (esSoporteReal) return 'soporte'
    // "como hago", "explicame" de un lead no registrado = ventas (quiere info)
    return 'ventas'
  }

  // 4. Todo lo demás → ventas
  return 'ventas'
}
