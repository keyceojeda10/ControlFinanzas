/* ── LOS ARCHIVOS QUE MANDA POR WHATSAPP ─────────────────────────────────────
 *
 * Bloque 4: «los que mande al bot se adjuntan a su solicitud abierta». Solo si
 * el número es del DUEÑO de un negocio y ese negocio tiene una carga abierta:
 * una foto de un comprobante o de cualquier otra cosa, sin carga abierta, sigue
 * su camino de siempre (el bot). Así nadie termina con su recibo de pago
 * metido en la cartera.
 *
 * Fotos y documentos (PDF, Excel). El webhook antes descartaba los documentos.
 */

import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { solicitudAbierta, guardarArchivos, procesarSolicitud } from './solicitud'

const ultimos10 = (t) => String(t ?? '').replace(/\D/g, '').slice(-10)

/* Veinte fotos seguidas no son veinte «Recibido»: una respuesta cada dos
   minutos por negocio (por instancia; con dos instancias, dos como mucho). Desde
   el 1 oct cada mensaje se cobra. */
const ultimaRespuesta = new Map()
const RESPONDER_CADA_MS = 2 * 60000

/** El negocio cuyo DUEÑO escribe desde este número, o null. */
async function negocioDelDueno(from) {
  const tel = ultimos10(from)
  if (tel.length < 10) return null
  const dueno = await prisma.user.findFirst({ where: { rol: 'owner', telefono: { endsWith: tel } }, select: { organizationId: true } })
  return dueno?.organizationId ?? null
}

/**
 * @returns {Promise<boolean>} true si el mensaje era para la carga y ya se atendió.
 */
export async function adjuntarDesdeWhatsApp(msg) {
  const tipo = String(msg?.type ?? '').toLowerCase()
  if (tipo !== 'image' && tipo !== 'document') return false
  const organizationId = await negocioDelDueno(msg.from)
  if (!organizationId) return false
  const abierta = await solicitudAbierta(organizationId)
  if (!abierta) return false

  const media = tipo === 'image' ? msg.image : msg.document
  const dl = await wa.downloadMedia(media?.id)
  if (!dl?.base64) {
    await wa.sendText(msg.from, 'No pude descargar ese archivo. ¿Lo puede mandar otra vez?').catch(() => null)
    return true
  }
  const ext = (dl.mimetype || '').split('/')[1]?.split(';')[0] || 'bin'
  const nombre = media?.filename || `whatsapp-${Date.now()}.${ext}`
  const r = await guardarArchivos(organizationId, [{ buffer: Buffer.from(dl.base64, 'base64'), nombre }], { origen: 'whatsapp', wamid: msg.id || null })
  if (r.repetido) return true
  const texto = r.nuevos > 0
    ? 'Recibido. Lo sumamos a la carga de su cartera y le avisamos cuando quede lista.'
    : `No lo pude sumar a la carga: ${r.rechazados[0] ?? 'formato que no sé leer'}. Mándelo como foto, Excel o PDF.`
  const antes = ultimaRespuesta.get(organizationId) ?? 0
  if (r.nuevos === 0 || Date.now() - antes > RESPONDER_CADA_MS) {
    ultimaRespuesta.set(organizationId, Date.now())
    await wa.sendText(msg.from, texto).catch(() => null)
  }
  if (r.nuevos > 0) void procesarSolicitud(r.solicitud.id).catch((e) => console.error('[carga-asesor] wa:', e?.message))
  return true
}
