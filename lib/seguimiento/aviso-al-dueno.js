/* ── LO QUE NO PUEDE ESPERAR A LAS 9 A. M. (2 nov 2026) ──────────────────────
 *
 * El dueño: «me llega un montón de cosas al Telegram que hasta las ignoro». La
 * alerta de siempre (`alertarLeadCaliente`) va al WhatsApp de soporte y al
 * Telegram, y ahí se pierde. Esto va a SU WhatsApp (`ATENDER_WHATSAPP`, los
 * mismos de la lista de las 9) y solo en dos casos, medidos el 2 nov:
 *
 *   · quiere pagar: «¿cómo pago?», «Nequi»… pagó el 83 % de los que lo
 *     escribieron (6 de 664 registros). Uno preguntó y nadie le cerró.
 *   · el bot le prometió una llamada o una demo con hora: «mañana a las 11 el
 *     equipo le muestra cómo funciona en vivo». Si nadie se entera, la promesa
 *     la incumple Control Finanzas. 4 personas en 30 días.
 *
 * Uno por persona y por día: lo que ya salió queda en `Evento`.
 */

import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { destinatarios, diaBogota } from './enlace-atender'
import { EMPRESA } from '@/lib/bot-v2/kb'

/* La promesa tiene que llevar las dos cosas: alguien del equipo (llamada,
   demo) y un cuándo.
   ⚠ «En vivo» solo NO cuenta, y el horario de soporte se quita antes de
   mirar el cuándo: los textos fijos dicen «le resuelven en vivo, de 7am a
   10pm», que no es una cita con nadie. Y «llama» suelto tampoco: el bot
   habla mucho de los cobradores del cliente («mientras usted no le llama a
   cada uno»). Medido sobre los 3.409 mensajes del bot de 30 días. */
const RX_QUIEN = /agendar|agendamos|videollamada|una llamada (?:con|de) (?:el|nuestro) equipo|\b(?:le|lo|la|te) (?:llamamos|vamos a llamar|llamaremos)\b|el equipo (?:le|te|lo|la) (?:muestr|ense|llam)/i
const RX_CUANDO = /\bma[ñn]ana\b|\bhoy\b|\ba las \d|\bde la (?:ma[ñn]ana|tarde|noche)\b|\bqu[eé] hora\b|\b\d{1,2}\s*(?:a\.?\s*m|p\.?\s*m)/i
const SIN_HORARIO = new RegExp([EMPRESA.horarioSoporte, EMPRESA.horarioSoporteLargo].filter(Boolean).map((h) => h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')

export function prometeCita(texto) {
  const t = String(texto || '').replace(SIN_HORARIO, '')
  return RX_QUIEN.test(t) && RX_CUANDO.test(t)
}

const MOTIVO_PAGO = new Set(['intencion_pago', 'intencion_pago_registrado'])
export const esQuierePagar = (motivo) => MOTIVO_PAGO.has(motivo)

/**
 * Manda el aviso a cada persona de `ATENDER_WHATSAPP`, una vez por lead y por
 * día. Nunca lanza: el lead ya fue atendido y esto es un extra.
 */
export async function avisarAlDueno({ lead, motivo, ahora = new Date() }) {
  try {
    const lista = destinatarios()
    if (!lista.length || !lead?.id) return { enviados: 0 }
    const clave = `aviso_dueno:${diaBogota(ahora)}:${lead.id}`
    const ya = await prisma.evento.findFirst({ where: { evento: 'aviso_dueno', pagina: clave }, select: { id: true } })
    if (ya) return { enviados: 0, repetido: true }

    const tel = String(lead.telefono || '').replace(/\D/g, '')
    let enviados = 0
    for (const { numero } of lista) {
      const r = await wa.sendTemplate(numero, 'alerta_escalamiento', {
        nombre: String(lead.nombre || 'Un cliente').slice(0, 60),
        motivo: String(motivo).slice(0, 300),
        telefono: tel || '573011993001',
      }).catch((e) => ({ error: e?.message ?? 'error' }))
      if (!r?.error) enviados++
    }
    if (enviados) await prisma.evento.create({ data: { evento: 'aviso_dueno', pagina: clave, metadata: JSON.stringify({ leadId: lead.id, motivo: String(motivo).slice(0, 300) }) } })
    return { enviados }
  } catch (e) {
    console.error('[aviso al dueño]', e.message)
    return { enviados: 0 }
  }
}
