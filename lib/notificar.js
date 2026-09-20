// lib/notificar.js — LA ÚNICA PUERTA DE UN AVISO.
//
// Antes había dos caminos que no se hablaban:
//   · `prisma.notificacion.create` → la campana. Solo lo usaban TRES sitios.
//   · `enviarPush` → el teléfono. Lo usaban once, y ninguno dejaba rastro.
// Así que lo que de verdad necesita al dueño —aprobar un préstamo, una
// reapertura de caja— llegaba SOLO por push, que tiene encendido el 14 % de los
// dueños (87 de 640, 19 sep 2026), y con el teléfono apagado se perdía para
// siempre. Y al revés: la campana solo sabía decir «fulano se atrasó».
//
// `notificar()` hace las dos cosas a la vez y respeta lo que cada usuario pidió
// en Configuración (`lib/avisos-preferencias.js`).
//
// ⚠ NUNCA LANZA. Se llama desde rutas que mueven plata —registrar un pago,
// cerrar una caja— y un aviso que falla no puede tumbar un cobro. Todo va dentro
// de un try/catch y los fallos se quedan en el log.

import { prisma } from '@/lib/prisma'
import { enviarPush } from '@/lib/push'
import { quiere, seGuarda } from '@/lib/avisos-preferencias'

/**
 * @param organizationId
 * @param para      'owners' | id de usuario | lista de ids
 * @param tipo      ver `GRUPO_DE` en `avisos-preferencias.js`
 * @param titulo    corto: es el título del push y de la fila
 * @param mensaje   una frase, con la cifra si hay plata
 * @param href      a dónde lleva al tocarlo (la campana y el push)
 * @param datos     extra que viaja en `Notificacion.datos` (ids, montos)
 * @param push      false = solo campana
 * @param guardar   false = solo push (por defecto lo decide el grupo)
 * @param excepto   id de usuario al que NO avisar (quien hizo la acción)
 */
export async function notificar({
  organizationId, para = 'owners', tipo, titulo, mensaje,
  href = null, datos = {}, push = true, guardar, excepto = null,
}) {
  try {
    if (!organizationId || !tipo || !titulo) return { avisados: 0 }

    const donde = para === 'owners'
      ? { organizationId, rol: 'owner', activo: true }
      : { organizationId, id: { in: Array.isArray(para) ? para.filter(Boolean) : [para].filter(Boolean) } }
    if (para !== 'owners' && donde.id.in.length === 0) return { avisados: 0 }

    const usuarios = await prisma.user.findMany({
      where: donde,
      select: { id: true, prefsAvisos: true },
    })
    const destinatarios = usuarios.filter((u) => u.id !== excepto && quiere(u.prefsAvisos, tipo))
    if (destinatarios.length === 0) return { avisados: 0 }

    if (guardar ?? seGuarda(tipo)) {
      await prisma.notificacion.createMany({
        data: destinatarios.map((u) => ({
          organizationId,
          userId: u.id,
          tipo,
          titulo,
          mensaje: mensaje ?? '',
          datos: JSON.stringify({ ...(href ? { href } : {}), ...datos }),
        })),
      })
    }

    if (push) {
      // `tag`: dos avisos del mismo asunto se reemplazan en la bandeja del
      // teléfono en vez de apilarse (diez «Pago registrado» seguidos).
      const tag = datos?.tag ?? tipo
      await Promise.allSettled(destinatarios.map((u) => enviarPush(u.id, {
        title: titulo, body: mensaje ?? '', url: href || '/dashboard', tag,
      })))
    }

    return { avisados: destinatarios.length }
  } catch (e) {
    console.error('[notificar]', tipo, e?.message)
    return { avisados: 0, error: true }
  }
}

/** Plata para un aviso: «$1.250.000». Los avisos salen del servidor, sin sesión
 *  de país a mano en los crons, así que el formato es el de siempre. */
export function plata(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString('es-CO')}`
}
