// lib/bot/router.js — Router determinístico (no IA)
// Solo dos destinos: ventas (siempre) o escalamiento (cuando pide humano).
// Todo lo demás — incluido soporte técnico — lo maneja el prompt de ventas.

const KEYWORDS_ESCALAMIENTO = [
  'hablar con persona', 'hablar con una persona', 'hablar con alguien',
  'quiero hablar', 'quiero un asesor', 'pasame con alguien',
  'asesor', 'llamada', 'videollamada',
  'atencion humana', 'persona real', 'quiero un humano',
]

const CURIOSIDAD_NO_ESCALAR = [
  'persona o robot', 'robot o persona',
  'humano o robot', 'robot o humano',
  'humano o bot', 'bot o humano',
  'persona o bot', 'bot o persona',
  'eres robot', 'eres un robot', 'eres bot', 'eres un bot',
  'es un robot', 'es un bot', 'eres real',
  'hablo con un robot', 'hablo con un bot',
  'hablo con persona o', 'hablo con una persona o',
  'es una persona', 'es persona',
]

const KEYWORDS_PAGO = [
  'quiero pagar', 'como pago', 'activar plan', 'se me acabo',
  'se vencio', 'se me vencio', 'vencio mi prueba', 'vencio la prueba',
  'como contrato', 'como sigo',
  'quiero el plan', 'quiero seguir', 'renovar',
]

const ESTADOS_REGISTRADO = ['registrado', 'registrado_demo']

function quitarAcentos(s) {
  return s.replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
}

/**
 * @returns {'ventas' | 'escalamiento'}
 */
export function clasificar({ mensaje, estadoRegistro, estadoLead, historial = [] }) {
  const txt = quitarAcentos((mensaje || '').toLowerCase())

  const esCuriosidad = CURIOSIDAD_NO_ESCALAR.some(k => txt.includes(k))
  if (!esCuriosidad && KEYWORDS_ESCALAMIENTO.some(k => txt.includes(k))) {
    return 'escalamiento'
  }

  const yaRegistrado = (estadoRegistro || '').startsWith('registrado')
    || ESTADOS_REGISTRADO.some(e => (estadoLead || '').startsWith(e))

  if (yaRegistrado && KEYWORDS_PAGO.some(k => txt.includes(k))) {
    return 'escalamiento'
  }

  return 'ventas'
}
