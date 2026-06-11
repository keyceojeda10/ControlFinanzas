// lib/bot/notificar-meta.js — Reporta a Meta CAPI el avance de un BotLead
// dentro del CRM (Conversions API for CRM), para que el algoritmo de Lead
// Ads aprenda que perfiles realmente se contactan, califican o convierten.

import { prisma } from '@/lib/prisma'
import { sendConversionEvent } from '@/lib/facebook-capi'

// custom_data.value para el evento "converted" (registro). Es un valor
// simbolico para que Meta optimice por valor y no solo por cantidad de leads.
const VALOR_CONVERSION = 50000
const MONEDA_CONVERSION = 'COP'

/**
 * Envia a Meta CAPI un evento "Lead" con el lead_qualification correspondiente
 * al nuevo estado de un BotLead. Fire-and-forget: nunca lanza, solo loguea.
 *
 * @param {string} botLeadId
 * @param {'contacted'|'qualified'|'unqualified'|'converted'} qualification
 */
export async function notificarEstadoLead(botLeadId, qualification) {
  try {
    const lead = await prisma.botLead.findUnique({
      where: { id: botLeadId },
      select: { telefono: true, cfLead: { select: { leadgenId: true } } },
    })
    if (!lead) return

    const leadId = lead.cfLead?.leadgenId || undefined
    // Sin leadgenId (lead organico, no de Facebook Ads) y sin telefono no hay
    // forma de correlacionar el evento con nada util en Meta.
    if (!leadId && !lead.telefono) return

    const customData = qualification === 'converted'
      ? { lead_qualification: qualification, value: VALOR_CONVERSION, currency: MONEDA_CONVERSION }
      : { lead_qualification: qualification }

    await sendConversionEvent({
      eventName: 'Lead',
      phone: lead.telefono,
      leadId,
      customData,
    })
  } catch (e) {
    console.error('[Meta CAPI] Error notificando estado de lead:', e.message)
  }
}
