/* ── ENVIAR UN PASO DEL SEGUIMIENTO ──────────────────────────────────────────
 *
 * ⚠ SE RESERVA ANTES DE MANDAR. La fila de `EnvioSeguimiento` se crea primero
 *   (`@@unique([claveCaso, paso])`): si dos vueltas del cron coinciden, la
 *   segunda choca con la clave y no manda. Mandar primero y apuntar después
 *   abre la puerta al mensaje doble, que se paga dos veces y molesta.
 *
 * Si Meta no ha aprobado la plantilla, NO se reserva nada: el paso queda
 * pendiente y sale cuando la aprueben (ver `meta.js`).
 */

import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { parametrosDe } from './plantillas'
import { plantillaAprobada } from './meta'
import { puedeEnviarHoy } from './reglas'
import { notificar } from '@/lib/notificar'
import { reintentableTrasCorte } from './corte'

export async function seguimientoDe(organizationId) {
  return prisma.seguimientoOrg.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  })
}

/**
 * Un paso por notificación de la app (push + campana): gratis, para lo que no
 * pasaría como plantilla de utilidad. Mismas reglas: se reserva antes, uno al
 * día y nunca con `noMolestar`.
 */
export async function enviarPush({ organizationId, caso, claveCaso, paso, titulo, mensaje, href = '/dashboard', ahora = new Date() }) {
  const seg = await seguimientoDe(organizationId)
  if (seg.noMolestar) return { enviado: false, motivo: 'no_molestar' }
  if (!puedeEnviarHoy(seg, ahora)) return { enviado: false, motivo: 'ya_hoy' }
  try {
    await prisma.envioSeguimiento.create({ data: { organizationId, caso, claveCaso, paso, canal: 'push', ok: true } })
  } catch (e) {
    if (e?.code === 'P2002') return { enviado: false, motivo: 'ya_enviado' }
    throw e
  }
  await notificar({ organizationId, tipo: 'prueba', titulo, mensaje, href })
  await prisma.seguimientoOrg.update({ where: { organizationId }, data: { ultimoEnvioAt: ahora } })
  return { enviado: true }
}

/**
 * @returns {Promise<{enviado: boolean, motivo?: string, envio?: object}>}
 */
export async function enviarPaso({ organizationId, telefono, caso, claveCaso, paso, plantilla, datos, ahora = new Date(), ignorarLimiteDiario = false }) {
  const seg = await seguimientoDe(organizationId)
  if (seg.noMolestar) return { enviado: false, motivo: 'no_molestar' }
  if (!ignorarLimiteDiario && !puedeEnviarHoy(seg, ahora)) return { enviado: false, motivo: 'ya_hoy' }
  if (!telefono || !wa.telefonoEnviable(telefono)) return { enviado: false, motivo: 'sin_telefono' }
  if (!(await plantillaAprobada(plantilla))) return { enviado: false, motivo: 'plantilla_sin_aprobar' }

  let parametros
  try { parametros = parametrosDe(plantilla, datos) } catch (e) { return { enviado: false, motivo: e.message } }

  let envio
  try {
    envio = await prisma.envioSeguimiento.create({
      data: { organizationId, caso, claveCaso, paso, canal: 'whatsapp', plantilla, ok: false },
    })
  } catch (e) {
    if (e?.code !== 'P2002') throw e
    /* Ya existe. Si no llegó porque Meta tenía la cuenta CORTADA, se vuelve a
       intentar (ver corte.js). La fila se reclama con un `updateMany` que
       exige su error de antes: si dos vueltas coinciden, solo una gana. */
    const previa = await prisma.envioSeguimiento.findUnique({ where: { claveCaso_paso: { claveCaso, paso } } })
    if (!reintentableTrasCorte(previa)) return { enviado: false, motivo: 'ya_enviado' }
    const { count } = await prisma.envioSeguimiento.updateMany({
      where: { id: previa.id, ok: false, error: previa.error },
      data: { error: null, plantilla },
    })
    if (!count) return { enviado: false, motivo: 'ya_enviado' }
    envio = previa
  }

  try {
    const r = await wa.sendTemplate(telefono, plantilla, parametros, 'es')
    envio = await prisma.envioSeguimiento.update({
      where: { id: envio.id },
      data: { ok: true, wamid: wa.wamidDe(r) ?? null },
    })
    await prisma.seguimientoOrg.update({ where: { organizationId }, data: { ultimoEnvioAt: ahora } })
    return { enviado: true, envio }
  } catch (e) {
    /* El intento queda apuntado con su error y NO se reintenta solo: un número
       que Meta rechaza (no tiene WhatsApp, bloqueó) volvería a fallar cada hora. */
    await prisma.envioSeguimiento.update({
      where: { id: envio.id },
      data: { ok: false, error: String(e?.message ?? e).slice(0, 2000) },
    }).catch(() => {})
    return { enviado: false, motivo: 'error_meta', error: e?.message }
  }
}
