// lib/pagos/confirmar-nequi.js — CONFIRMAR LA AUTORIZACIÓN DE NEQUI Y GUARDAR EL MEDIO.
//
// ══ POR QUÉ VIVE AQUÍ (5 nov 2026) ═════════════════════════════════════════
//
// Para dejar el Nequi guardado el cliente pide la autorización en nuestra app,
// se va a su app de Nequi y la aprueba. El paso de GUARDAR lo hacía solo la
// pantalla, preguntando cada pocos segundos durante 3 minutos. Si aprobaba más
// tarde, o el teléfono dejaba nuestra página en segundo plano, nadie volvía a
// preguntar: el permiso quedaba APROBADO en Wompi y aquí no existía.
//
// Medido ese día: de 28 negocios que lo pidieron, 7 aprobaron y nunca quedaron
// guardados. Creían tener el cobro automático y el 35 % de descuento; a uno
// (Dj Wilman) se le venció el plan esperándolo.
//
// Ahora el pedido se apunta en la organización (`nequiTokenPendiente`) y esta
// función lo confirma desde DOS sitios: la pantalla, mientras esté abierta, y
// `/api/cron/confirmar-nequi`, cada diez minutos, aunque la cierren. Lo que
// pasa al aprobar es lo de siempre: se guarda el medio, se aplica la oferta y
// se cobra si toca.
//
// ⚠ EL COBRO NO SE DUPLICA aunque las dos vías confirmen a la vez: el candado
//   del cobro (`cobroRefPendiente`, lib/cobro-intento.js) es el mismo de
//   siempre. Y solo una vía «reclama» el pedido (`updateMany` sobre el token).

import { prisma } from '@/lib/prisma'
import { estadoTokenNequi, crearFuenteDePago } from '@/lib/wompi'
import { cobrarAhoraSiToca } from '@/lib/cobro-intento'
import { motivoLegible } from '@/lib/cobro-automatico'
import { aplicarOfertaNequi } from '@/lib/seguimiento/oferta-nequi'

/** Marca del pedido que una vía ya está guardando. */
const GUARDANDO = 'guardando:'

/** Estados de Wompi que ya no van a cambiar: dijo que no o se le pasó el tiempo. */
const FINALES_SIN_PERMISO = ['DECLINED', 'VOIDED', 'ERROR']

/** Apunta el pedido para que el servidor lo pueda confirmar sin la pantalla. */
export async function apuntarPedidoNequi(organizationId, { tokenId, plan = null }) {
  await prisma.organization.update({
    where: { id: organizationId },
    data: { nequiTokenPendiente: tokenId, nequiTokenPedidoAt: new Date(), nequiPlanElegido: plan || null },
  })
}

/**
 * Pregunta a Wompi y, si está aprobado, guarda el Nequi, aplica la oferta y
 * cobra si toca. La llaman la pantalla y el cron.
 *
 * @param {{ organizationId: string, tokenId: string, planElegido?: string|null, origen: string }} a
 * @returns {Promise<{ estado: string, guardado: boolean, rotulo?: string, cobro?: object, error?: string }>}
 */
export async function confirmarNequi({ organizationId, tokenId, planElegido = null, origen }) {
  const estado = await estadoTokenNequi(tokenId)

  if (estado !== 'APPROVED') {
    /* PENDING es lo normal mientras no toque «Aceptar». Los finales se olvidan:
       el pedido ya no va a servir. */
    if (FINALES_SIN_PERMISO.includes(estado)) {
      await prisma.organization.updateMany({
        where: { id: organizationId, nequiTokenPendiente: tokenId },
        data: { nequiTokenPendiente: null, nequiTokenPedidoAt: null, nequiPlanElegido: null },
      })
    }
    return { estado, guardado: false }
  }

  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { nequiTokenPendiente: true, nequiPlanElegido: true, wompiFuentePagoId: true, wompiFuenteTipo: true },
  })
  const plan = planElegido || org?.nequiPlanElegido || null

  const dueno = await prisma.user.findFirst({
    where: { organizationId, rol: 'owner' },
    select: { email: true },
  })
  if (!dueno?.email) return { estado, guardado: false, error: 'La cuenta no tiene correo; Wompi lo exige' }

  /* RECLAMAR EL PEDIDO: de la pantalla y el cron, solo uno crea la fuente. El
     que llega segundo ve que ya se está guardando, o que ya se guardó. Un
     pedido de antes de este cambio no está apuntado: ese lo guarda la
     pantalla, como siempre. */
  const reclamo = await prisma.organization.updateMany({
    where: { id: organizationId, nequiTokenPendiente: tokenId },
    data: { nequiTokenPendiente: `${GUARDANDO}${tokenId}` },
  })
  if (reclamo.count === 0) {
    const yaVa = org?.nequiTokenPendiente === `${GUARDANDO}${tokenId}`
    const yaEsta = !org?.nequiTokenPendiente && org?.wompiFuentePagoId && org?.wompiFuenteTipo === 'NEQUI'
    if (yaVa || (yaEsta && origen !== 'guardar-nequi')) return { estado, guardado: true }
  }

  let fuente
  try {
    fuente = await crearFuenteDePago({ token: tokenId, tipo: 'NEQUI', email: dueno.email })
  } catch (e) {
    // Se devuelve el pedido para que el próximo intento lo vuelva a tomar.
    await prisma.organization.updateMany({
      where: { id: organizationId, nequiTokenPendiente: `${GUARDANDO}${tokenId}` },
      data: { nequiTokenPendiente: tokenId },
    })
    throw e
  }
  const tel = String(fuente.publico?.phone_number ?? '')
  const rotulo = tel ? `Nequi ···${tel.slice(-4)}` : 'Nequi'

  await prisma.organization.update({
    where: { id: organizationId },
    data: {
      wompiFuentePagoId: fuente.id,
      wompiFuenteRotulo: rotulo,
      wompiFuenteTipo:   'NEQUI',
      wompiFuenteEmail:  dueno.email,
      cobroAutomatico:   true,
      /* Empieza de cero: si venía de tres cobros fallidos con el medio viejo,
         el nuevo no arrastra ese historial. ⚠ El rechazo NO se borra: quitar y
         volver a poner el Nequi no puede ser la forma de seguir dentro sin
         pagar. Lo borra el pago. */
      cobroFallos:       0,
      nequiTokenPendiente: null,
      nequiTokenPedidoAt:  null,
      nequiPlanElegido:    null,
    },
  })
  console.log(`[wompi-nequi] GUARDADO ${rotulo} para org ${organizationId} — fuente ${fuente.id} (${origen})`)

  /* El 35 % por dejar el medio guardado, si tiene la oferta: va ANTES del
     cobro para que el primero ya salga con descuento (lib/seguimiento/oferta-nequi.js). */
  await aplicarOfertaNequi(organizationId, { planElegido: plan })

  /* Y se cobra aquí si toca, con las reglas de la tarjeta. El medio queda
     guardado aunque el cobro falle. */
  let cobro
  try {
    const r = await cobrarAhoraSiToca({ orgId: organizationId, planElegido: plan, origen })
    cobro = {
      resultado: r.resultado,
      motivo: ['rechazado', 'error'].includes(r.resultado) ? motivoLegible(r.motivo) : null,
    }
  } catch (e) {
    console.error('[wompi-nequi] falló el primer cobro:', e.message)
    cobro = { resultado: 'error', motivo: 'No pudimos hacer el cobro ahora. Reinténtalo en unos minutos.' }
  }
  return { estado, guardado: true, rotulo, cobro }
}
