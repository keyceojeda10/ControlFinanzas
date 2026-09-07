// app/api/cron/leads-recovery/route.js
// One-shot: recontacta leads que nunca recibieron el primer mensaje
// por el fallo de entrega 131042 (problema de pago Meta, jul 5-10 2026).
//
// Envia la plantilla contacto_v2 a todos de una sola vez (son plantillas
// aprobadas, no hay riesgo de ban). Limpia mensajes fallidos y resetea
// cada lead para que el bot lo atienda cuando responda.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
/* ⚠ EL MISMO HOOK QUE MANDA `lib/bot/bridge.js`. El A/B de julio dejó aquí
   las v3 (54 % responde, 8 % registra) mientras el primer contacto ya había
   vuelto a contacto_v2 (64 % / 23,6 %). Las dos variantes apuntan a la misma
   plantilla para no tocar el reparto ni las columnas de la medición. */
const AB_TEMPLATES = { A: 'contacto_v2', B: 'contacto_v2' }
const AB_TEXTOS = {
  A: nombre => `Hola ${nombre}, vimos su interes en Control Finanzas. Una pregunta rapida: usted lleva el control de sus cobros en libreta, en Excel o en alguna app?`,
  B: nombre => `Hola ${nombre}, le escribimos de Control Finanzas. Usted sabe exactamente cuanto le deben sus clientes hoy, o le toca sumar a mano?`,
}

function primerNombre(nombre) {
  if (!nombre || nombre === 'Sin nombre') return 'que tal'
  const limpio = nombre.trim()
  if (/\d|club|store|shop|tienda|empresa|negocio/i.test(limpio)) return 'que tal'
  const partes = limpio.split(/\s+/)
  if (partes.length > 4) return 'que tal'
  const primer = partes[0]
  return primer.charAt(0).toUpperCase() + primer.slice(1).toLowerCase()
}

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp Cloud API no configurado' }, { status: 500 })
  }

  try {
    const leads = await prisma.botLead.findMany({
      where: {
        createdAt: { gte: new Date('2026-07-05T00:00:00Z'), lte: new Date('2026-07-11T00:00:00Z') },
        estado: 'contactado',
        temperatura: 0,
      },
      orderBy: { createdAt: 'asc' },
    })

    const resultado = { total: leads.length, enviados: 0, errores: 0, ya_respondieron: 0, varianteA: 0, varianteB: 0 }

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const respuestas = await prisma.botConversacion.count({
        where: { botLeadId: lead.id, rol: 'lead' },
      })
      if (respuestas > 0) {
        resultado.ya_respondieron++
        continue
      }

      const variante = i % 2 === 0 ? 'A' : 'B'
      const templateName = AB_TEMPLATES[variante]

      try {
        const nombre = primerNombre(lead.nombre)
        const envio = await wa.sendTemplate(lead.telefono, templateName, { nombre }, TEMPLATE_LANG)

        await prisma.botConversacion.deleteMany({
          where: { botLeadId: lead.id, rol: 'bot' },
        })

        await prisma.botConversacion.create({
          data: {
            botLeadId: lead.id,
            rol: 'bot',
            texto: AB_TEXTOS[variante](nombre),
            wamid: wa.wamidDe(envio),
          },
        })

        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            fechaContacto: new Date(),
            botActivo: true,
            intentosSeguimiento: 0,
            proximoSeguimiento: new Date(Date.now() + 24 * 3600000),
            abVariante: variante,
          },
        })

        resultado.enviados++
        resultado[`variante${variante}`]++
      } catch (e) {
        resultado.errores++
        console.error(`[Leads Recovery] Error ${lead.nombre}: ${e.message}`)

        if (e.message?.includes('131042')) {
          resultado.detenido = 'Error 131042 persiste — arreglar pago en Meta primero'
          break
        }
      }
    }

    console.log(`[Leads Recovery] Resultado:`, resultado)
    return NextResponse.json({ ok: true, ...resultado })
  } catch (error) {
    console.error('[Leads Recovery] Error:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
