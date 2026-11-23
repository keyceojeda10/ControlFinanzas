// lib/premio-referido.js — los 30 días que gana quien refirió. La ÚNICA vía.
//
// ══ POR QUÉ EXISTE (22 nov 2026) ═══════════════════════════════════════════
//
// El premio es «+30 días cuando tu referido PAGA POR PRIMERA VEZ». Había dos
// copias —la pasarela (`activarPlanPagado`) y «Asignar plan» del panel— y las
// dos decidían «primera vez» con `suscripcion.count() <= 1`. Pero `Suscripcion`
// NO es el historial: es UNA fila que cada pago pisa. Con eso:
//
//   · quien paga con cobro automático o a mano tiene siempre UNA fila, así que
//     CADA pago era «el primero» y el referidor ganaba un mes gratis cada mes.
//     Medido en producción: 5jleg3 pagó una vez (9 sep, hasta el 9 oct) y vence
//     el 9 dic — dos premios por los dos pagos de su referido, y el tercero
//     llegaba el 26 nov. Nunca más iba a pagar.
//   · quien abre el checkout de Wompi deja filas `pendiente`, así que el primer
//     pago de verdad podía contar 2 y no dar nada.
//
// Y no dejaba rastro: ni AdminLog ni nada. Una fecha que se movía sola.
//
// Ahora decide el LIBRO (`PagoSuscripcion`): es el primero si el libro tiene
// solo el pago que acaba de entrar y el AdminLog no tiene ningún pago anterior
// (el libro empezó el 14 ago y lo de antes se reconstruyó en parte). Cada
// premio queda escrito en el AdminLog del referidor, y ese apunte impide darlo
// dos veces por el mismo referido.
//
// ⚠ Llamar DESPUÉS de la transacción que apunta el pago en el libro y ANTES del
//   AdminLog de ese pago (`pago_aprobado` / `pago_directo`).

import { prisma } from '@/lib/prisma'
import { registrarAdminLog } from '@/lib/admin-log'
import { enviarEmail, emailReferidoExitoso } from '@/lib/email'

export const DIAS_PREMIO_REFERIDO = 30
export const ACCION_PREMIO_REFERIDO = 'premio_referido'
const ACCIONES_DE_PAGO = ['pago_aprobado', 'pago_directo']

/** ¿Este pago es el primero de verdad? Pura, para poder probarla. */
export function esPrimerPago({ pagosEnLibro, pagosEnLog, yaPremiado }) {
  return !yaPremiado && pagosEnLibro === 1 && pagosEnLog === 0
}

/**
 * Da el premio al referidor si `organizationId` acaba de hacer su primer pago.
 * Nunca tira: un premio que falla no puede tumbar la activación de un pago.
 *
 * @returns {Promise<{premio: boolean, motivo?: string, referidorId?: string, hasta?: Date}>}
 */
export async function darPremioReferido({ organizationId, ahora = new Date(), adminId } = {}) {
  try {
    if (!organizationId) return { premio: false, motivo: 'sin_organizacion' }
    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
      select: { referidoPorId: true, nombre: true },
    })
    const referidorId = org?.referidoPorId
    if (!referidorId) return { premio: false, motivo: 'sin_referidor' }

    const [pagosEnLibro, pagosEnLog, yaPremiado] = await Promise.all([
      prisma.pagoSuscripcion.count({ where: { organizationId, montoCOP: { gt: 0 } } }),
      prisma.adminLog.count({ where: { organizacionId: organizationId, accion: { in: ACCIONES_DE_PAGO } } }),
      prisma.adminLog.findFirst({
        where: { accion: ACCION_PREMIO_REFERIDO, detalle: { contains: organizationId } },
        select: { id: true },
      }),
    ])
    if (!esPrimerPago({ pagosEnLibro, pagosEnLog, yaPremiado: !!yaPremiado })) {
      return { premio: false, motivo: 'no_es_el_primer_pago' }
    }

    const sub = await prisma.suscripcion.findFirst({
      where: { organizationId: referidorId, OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }] },
      orderBy: { fechaVencimiento: 'desc' },
    })
    if (!sub) return { premio: false, motivo: 'referidor_sin_suscripcion' }

    const vence = new Date(sub.fechaVencimiento)
    const base = sub.estado === 'activa' && vence > ahora ? vence : new Date(ahora)
    const hasta = new Date(base)
    hasta.setUTCDate(hasta.getUTCDate() + DIAS_PREMIO_REFERIDO)
    await prisma.suscripcion.update({
      where: { id: sub.id },
      data: { fechaVencimiento: hasta, estado: 'activa' },
    })

    /* El id del referido es la llave que impide repetirlo: va AL PRINCIPIO,
       porque `registrarAdminLog` recorta a 191 caracteres y un nombre largo lo
       dejaría fuera. */
    await registrarAdminLog({
      adminId,
      organizacionId: referidorId,
      accion: ACCION_PREMIO_REFERIDO,
      detalle: `Referido ${organizationId}: +${DIAS_PREMIO_REFERIDO} días, `
        + `${vence.toISOString().slice(0, 10)} → ${hasta.toISOString().slice(0, 10)}, por el primer pago de "${org.nombre ?? ''}"`,
    })

    const ownerRef = await prisma.user.findFirst({
      where: { organizationId: referidorId, rol: 'owner' },
      select: { id: true, nombre: true, email: true, emailsMarketing: true },
    })
    if (ownerRef?.emailsMarketing) {
      const { subject, html } = emailReferidoExitoso({
        nombre: ownerRef.nombre,
        nombreReferido: org.nombre || 'Un referido',
        userId: ownerRef.id,
      })
      enviarEmail({ to: ownerRef.email, subject, html }).catch((e) => console.error('[Email] Fallo envio:', e.message))
    }
    return { premio: true, referidorId, hasta }
  } catch (e) {
    console.error('[premio-referido] no se pudo dar el premio de ' + organizationId + ': ' + e.message)
    return { premio: false, motivo: 'error' }
  }
}
