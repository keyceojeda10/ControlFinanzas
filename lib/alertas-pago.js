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

  return enviar(texto)
}

/**
 * Avisa que una transaccion que YA habia activado un plan fue anulada o
 * reversada por la pasarela. El cliente conserva el servicio y el dinero se
 * devolvio.
 *
 * A proposito NO se suspende el plan de forma automatica: cortarle el sistema a
 * un prestamista por un evento de la pasarela es peor que esperar. Si el evento
 * llegara mal, dejariamos sin trabajar a alguien que si pago. Decide un humano.
 *
 * @param {object} p
 * @param {'wompi'|'mercadopago'} p.gateway
 * @param {string} p.transaccionId
 * @param {string} p.estadoNuevo      estado al que paso (VOIDED, DECLINED...)
 * @param {string} [p.organizacion]   nombre de la organizacion afectada
 * @param {string} [p.plan]
 * @param {Date}   [p.fechaVencimiento]
 * @param {number} [p.montoCOP]
 */
export async function alertarPagoRevertido({
  gateway, transaccionId, estadoNuevo, organizacion, plan, fechaVencimiento, montoCOP,
}) {
  const monto = Number(montoCOP) > 0
    ? '$' + Math.round(Number(montoCOP)).toLocaleString('es-CO')
    : 'monto desconocido'
  const vence = fechaVencimiento
    ? new Date(fechaVencimiento).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })
    : '—'

  const texto =
`🔴 <b>PAGO REVERTIDO</b>

Una transaccion que YA habia activado un plan paso a <b>${esc(estadoNuevo)}</b>.
El cliente conserva el servicio y el dinero se devolvio.

Organizacion: <b>${esc(organizacion || 'desconocida')}</b>
Plan activo: <b>${esc(plan || '—')}</b> hasta <b>${esc(vence)}</b>
Monto: <b>${esc(monto)}</b>
Pasarela: ${esc(gateway)}
Transaccion: <code>${esc(transaccionId)}</code>

El plan NO se suspendio automaticamente. Revisar si corresponde suspenderlo.`

  return enviar(texto)
}

async function enviar(texto) {
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
