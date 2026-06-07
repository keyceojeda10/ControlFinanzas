// lib/bot/sender.js — Envio de seguimientos automaticos

import { prisma } from '@/lib/prisma'
import * as wa from './whatsapp-cloud'
import { generarSeguimiento } from './sales-agent'
import { ESPACIADO_SEGUIMIENTO, MAX_INTENTOS, delayAleatorio } from './constants'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

// El cron que dispara esto corre cada 30 min las 24h (servidor en UTC, sin
// ventana horaria). Sin este guard, el bot le escribe a leads colombianos a
// la 1-3 AM — molesta a la gente. Solo se envian seguimientos en horario
// "decente" (8am-9pm hora Colombia, UTC-5); fuera de esa franja se omite y
// el propio cron lo retoma en la siguiente corrida dentro del horario.
function enHorarioDecente() {
  const horaCol = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours()
  return horaCol >= 8 && horaCol < 21
}

// Plantilla aprobada para seguimientos en frio (fuera de la ventana de 24h).
// Si no esta configurada, los seguimientos fuera de ventana se SALTAN (no se
// puede enviar texto libre en frio con la Cloud API).
const TEMPLATE_SEGUIMIENTO = process.env.WHATSAPP_TEMPLATE_SEGUIMIENTO || ''
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const VENTANA_MS = 24 * 3600 * 1000

// Devuelve true si el lead respondio en las ultimas 24h (ventana abierta -> se
// puede enviar texto libre). Mira el ultimo mensaje entrante (rol 'lead').
async function ventanaAbierta(botLeadId) {
  const ultimoLead = await prisma.botConversacion.findFirst({
    where: { botLeadId, rol: 'lead' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!ultimoLead) return false
  return Date.now() - new Date(ultimoLead.createdAt).getTime() < VENTANA_MS
}

/**
 * Envia seguimientos a leads que no han avanzado.
 * Procesa max `limite` leads por ejecucion (anti-ban + timeout serverless).
 */
export async function enviarSeguimientos(limite = 3) {
  if (!wa.configurado()) {
    throw new Error('WhatsApp Cloud API no configurado.')
  }

  if (!enHorarioDecente()) {
    return { intentados: 0, enviados: 0, perdidos: 0, fallidos: 0, omitido: 'fuera_de_horario' }
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
        const abierta = await ventanaAbierta(lead.id)
        if (abierta) {
          // Ventana de 24h abierta: texto libre (gratis).
          await wa.sendText(lead.telefono, seg.mensaje)
          await prisma.botConversacion.create({
            data: { botLeadId: lead.id, rol: 'bot', texto: seg.mensaje },
          })
        } else if (TEMPLATE_SEGUIMIENTO) {
          // Fuera de ventana: solo se puede enviar plantilla aprobada.
          const nombre = (lead.nombre || 'amigo').split(' ')[0]
          await wa.sendTemplate(lead.telefono, TEMPLATE_SEGUIMIENTO, { nombre }, TEMPLATE_LANG)
          await prisma.botConversacion.create({
            data: { botLeadId: lead.id, rol: 'bot', texto: seg.mensaje },
          })
        } else {
          // No hay plantilla de seguimiento configurada: no se puede contactar
          // en frio. Reprogramar mas adelante sin marcar como enviado.
          console.log(`[Bot Sender] Sin ventana ni plantilla de seguimiento para ${lead.nombre}, omitido.`)
          continue
        }
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
