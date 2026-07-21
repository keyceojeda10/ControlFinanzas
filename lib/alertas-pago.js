// lib/alertas-pago.js — Avisos cuando entra plata y NO se pudo activar el plan.
//
// Es el peor escenario silencioso de una pasarela: el cliente paga, el dinero
// llega, y su plan no se activa. Si nadie se entera, el cliente cree que la app
// no sirve y nosotros creemos que todo va bien.
//
// Va al canal dedicado de Telegram (el mismo de leads calientes) porque es un
// "alguien tiene que actuar YA". Son eventos raros: no genera ruido.

import { sendMessage } from '@/lib/telegram'

function esc(t) {
  return String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Avisa que un pago APROBADO no se pudo convertir en plan activo.
 *
 * @param {object} p
 * @param {'wompi'|'mercadopago'} p.gateway
 * @param {string} p.transaccionId  id de la transaccion en la pasarela
 * @param {string} [p.referencia]   referencia enviada al checkout
 * @param {number} [p.montoCOP]
 * @param {string} p.motivo         por que no se pudo activar
 */
export async function alertarPagoSinActivar({ gateway, transaccionId, referencia, montoCOP, motivo }) {
  const monto = Number(montoCOP) > 0
    ? '$' + Math.round(Number(montoCOP)).toLocaleString('es-CO')
    : 'monto desconocido'

  const texto =
`🔴 <b>PAGO APROBADO SIN ACTIVAR</b>

Entró plata y el plan NO se activó. El cliente pagó y no tiene servicio.

Pasarela: <b>${esc(gateway)}</b>
Monto: <b>${esc(monto)}</b>
Transacción: <code>${esc(transaccionId)}</code>
Referencia: <code>${esc(referencia || '—')}</code>

Motivo: ${esc(motivo)}

Hay que activarlo a mano y avisarle al cliente.`

  try {
    const r = await sendMessage(texto, null, 'escalamiento')
    if (!r?.ok) console.error('[alertas-pago] Telegram no confirmo el envio')
    return Boolean(r?.ok)
  } catch (e) {
    // Nunca romper el webhook por culpa del aviso: la pasarela reintentaria
    // el evento y podriamos duplicar trabajo.
    console.error('[alertas-pago] Error enviando alerta:', e.message)
    return false
  }
}
