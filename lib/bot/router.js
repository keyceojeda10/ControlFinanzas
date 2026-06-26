// lib/bot/router.js — Router determinístico (no IA)
// Solo dos destinos: ventas (siempre) o escalamiento (cuando pide humano).
// Todo lo demás — incluido soporte técnico — lo maneja el prompt de ventas.

const KEYWORDS_ESCALAMIENTO = [
  'persona', 'humano', 'asesor', 'llamada', 'videollamada',
  'hablar con alguien', 'hablar con una persona', 'quiero hablar',
  'atencion humana', 'persona real',
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

  if (KEYWORDS_ESCALAMIENTO.some(k => txt.includes(k))) {
    return 'escalamiento'
  }

  const yaRegistrado = (estadoRegistro || '').startsWith('registrado')
    || ESTADOS_REGISTRADO.some(e => (estadoLead || '').startsWith(e))

  if (yaRegistrado && KEYWORDS_PAGO.some(k => txt.includes(k))) {
    return 'escalamiento'
  }

  return 'ventas'
}
