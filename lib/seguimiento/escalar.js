/* ── EL AVISO A CARLOS ───────────────────────────────────────────────────────
 *
 * El bot atiende primero, siempre. Carlos recibe un Telegram solo en cuentas de
 * 100 clientes o más, y con TODO lo necesario para llamar sin abrir nada más:
 * nombre, teléfono, clientes, plan y monto, último uso, qué le dijo el bot, qué
 * respondió y qué hacer. Una sola vez por caso: se marca `escaladoAt` en el
 * envío que lo provocó.
 *
 * «INVERSIONES JM (759 clientes, $79.000 al mes) se fue y nadie le escribió
 *  nada estructurado» — auditoría del 12 oct 2026.
 */

import { prisma } from '@/lib/prisma'
import { sendMessage, escapeHtml } from '@/lib/telegram'
import { PLANTILLAS_SEGUIMIENTO } from './plantillas'

const pesos = (n) => `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'America/Bogota' }) : 'sin dato')

export function textoDelAviso({ org, telefono, clientes, plan, monto, ultimoUso, envio, respuesta, accion }) {
  const dijo = envio?.plantilla ? (PLANTILLAS_SEGUIMIENTO[envio.plantilla]?.texto ?? envio.plantilla) : 'nada todavía'
  return [
    `<b>Llamar: ${escapeHtml(org)}</b>`,
    `Teléfono: ${escapeHtml(telefono || 'sin teléfono')}`,
    `Clientes: ${clientes} · Plan: ${escapeHtml(plan || 'sin plan')} (${pesos(monto)})`,
    `Último uso de la app: ${fecha(ultimoUso)}`,
    `El bot le dijo: «${escapeHtml(dijo)}»`,
    `Respondió: ${respuesta ? `«${escapeHtml(respuesta)}»` : 'nada'}`,
    `<b>Qué hacer:</b> ${escapeHtml(accion)}`,
  ].join('\n')
}

/** Manda el aviso y marca el envío. Si Telegram falla, no se marca: se reintenta. */
export async function escalar({ envioId, ...datos }) {
  const r = await prisma.envioSeguimiento.updateMany({
    where: { id: envioId, escaladoAt: null },
    data: { escaladoAt: new Date() },
  })
  if (r.count === 0) return false // otro proceso ya lo avisó
  // `sendMessage` no lanza: devuelve null (sin token) o { ok: false }.
  const r2 = await sendMessage(textoDelAviso(datos), null, 'escalamiento').catch(() => null)
  if (r2?.ok) return true
  await prisma.envioSeguimiento.update({ where: { id: envioId }, data: { escaladoAt: null } }).catch(() => {})
  return false
}
