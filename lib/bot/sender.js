// lib/bot/sender.js — Envio de seguimientos automaticos

import { prisma } from '@/lib/prisma'
import * as openwa from './openwa-client'
import { generarSeguimiento } from './sales-agent'
import { ESPACIADO_SEGUIMIENTO, MAX_INTENTOS, delayAleatorio } from './constants'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

/**
 * Envia seguimientos a leads que no han avanzado.
 * Procesa max `limite` leads por ejecucion (anti-ban + timeout serverless).
 */
export async function enviarSeguimientos(limite = 3) {
  if (!openwa.configurado()) {
    throw new Error('OpenWA no configurado.')
  }

  // Leer config de delays
  const config = await prisma.botConfig.findFirst()
  const delayMin = config?.delayMinMs || 30000
  const delayMax = config?.delayMaxMs || 60000

  const candidatos = await prisma.botLead.findMany({
    where: {
      botActivo: true,
      estado: { in: ['contactado', 'interesado'] },
      proximoSeguimiento: { not: null, lte: new Date() },
    },
    orderBy: { proximoSeguimiento: 'asc' },
    take: limite,
  })

  const resultado = { intentados: 0, enviados: 0, perdidos: 0, fallidos: 0 }

  for (let i = 0; i < candidatos.length; i++) {
    const lead = candidatos[i]
    resultado.intentados++
    const intento = (lead.intentosSeguimiento || 0) + 1

    try {
      const historial = await prisma.botConversacion.findMany({
        where: { botLeadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      historial.reverse()

      const seg = await generarSeguimiento(lead, historial, intento)

      if (seg.darPorPerdido) {
        await prisma.botLead.update({
          where: { id: lead.id },
          data: { estado: 'no_interesado', proximoSeguimiento: null },
        })
        resultado.perdidos++
        console.log(`[Bot Sender] Perdido: ${lead.nombre}`)
        continue
      }

      if (seg.mensaje) {
        await openwa.sendText(lead.telefono, seg.mensaje)
        await prisma.botConversacion.create({
          data: { botLeadId: lead.id, rol: 'bot', texto: seg.mensaje },
        })
      }

      // Avanzar seguimiento
      const intentosActualizados = intento
      if (intentosActualizados >= MAX_INTENTOS) {
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            intentosSeguimiento: intentosActualizados,
            proximoSeguimiento: null,
            estado: 'no_interesado',
          },
        })
        resultado.perdidos++
        console.log(`[Bot Sender] Ultimo seguimiento: ${lead.nombre}`)
      } else {
        const dias = ESPACIADO_SEGUIMIENTO[intentosActualizados] || 7
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            intentosSeguimiento: intentosActualizados,
            proximoSeguimiento: new Date(Date.now() + dias * 24 * 3600000),
          },
        })
        console.log(`[Bot Sender] Seguimiento #${intento}: ${lead.nombre}`)
      }

      resultado.enviados++
    } catch (e) {
      resultado.fallidos++
      console.error(`[Bot Sender] Error: ${lead.nombre} - ${e.message}`)
    }

    // Delay anti-ban entre mensajes
    if (i < candidatos.length - 1) {
      await delay(delayAleatorio(delayMin, delayMax))
    }
  }

  return resultado
}
