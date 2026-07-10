// lib/bot-v2/sender.js — Envio de seguimientos (reutiliza whatsapp-cloud del v1)

import { prisma } from '@/lib/prisma'
import * as wa from '../bot/whatsapp-cloud'
import { generarSeguimiento } from './agente.js'
import { notificarEstadoLead } from '../bot/notificar-meta'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

const ESPACIADO = [1, 2, 3, 5, 7]
const MAX_INTENTOS = 5
const VENTANA_MS = 24 * 3600 * 1000

const TEMPLATE_SEGUIMIENTO = process.env.WHATSAPP_TEMPLATE_SEGUIMIENTO || ''
const TEMPLATE_DESCUBRIMIENTO = 'seguimiento_descubrimiento'
const TEMPLATE_VIDEO = 'seguimiento_video'
const TEMPLATE_REGISTRO = 'seguimiento_registro'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

function elegirPlantilla(historial, intento) {
  const leadRespondio = historial.some(m => m.rol === 'lead')
  const textosBot = historial.filter(m => m.rol === 'bot').map(m => (m.texto || '')).join(' ')
  const linkEnviado = textosBot.includes('app.control-finanzas.com/registro')
  const videoEnviado = /youtu\.be|youtube\.com/i.test(textosBot)

  if (leadRespondio && !videoEnviado && !linkEnviado) {
    return TEMPLATE_DESCUBRIMIENTO
  }
  if (videoEnviado && !linkEnviado) {
    return TEMPLATE_REGISTRO
  }
  if (!leadRespondio && !videoEnviado) {
    return TEMPLATE_VIDEO
  }
  return TEMPLATE_SEGUIMIENTO || 'seguimiento_lead'
}

function enHorarioDecente() {
  const horaCol = new Date(Date.now() - 5 * 3600 * 1000).getUTCHours()
  return horaCol >= 8 && horaCol < 21
}

async function ventanaAbierta(botLeadId) {
  const ultimo = await prisma.botConversacion.findFirst({
    where: { botLeadId, rol: 'lead' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!ultimo) return false
  return Date.now() - new Date(ultimo.createdAt).getTime() < VENTANA_MS
}

function delayAleatorio(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

export async function enviarSeguimientos(limite = 3) {
  if (!wa.configurado()) throw new Error('WhatsApp Cloud API no configurado.')
  if (!enHorarioDecente()) {
    return { intentados: 0, enviados: 0, perdidos: 0, fallidos: 0, omitido: 'fuera_de_horario' }
  }

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
        const estadoFinal = (lead.temperatura || 0) >= 60 ? 'contactado' : 'no_interesado'
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            estado: estadoFinal,
            proximoSeguimiento: estadoFinal === 'contactado' ? new Date(Date.now() + 7 * 24 * 3600000) : null,
            botActivo: estadoFinal === 'contactado',
          },
        })
        notificarEstadoLead(lead.id, 'unqualified').catch(() => {})
        resultado.perdidos++
        continue
      }

      if (seg.mensaje) {
        const abierta = await ventanaAbierta(lead.id)
        const leadRespondio = historial.some(m => m.rol === 'lead')

        if (abierta && leadRespondio) {
          const envio = await wa.sendText(lead.telefono, seg.mensaje)
          await prisma.botConversacion.create({
            data: { botLeadId: lead.id, rol: 'bot', texto: seg.mensaje, wamid: wa.wamidDe(envio) },
          })
        } else {
          const nombre = (lead.nombre || 'amigo').split(' ')[0]
          const template = elegirPlantilla(historial, intento)
          const envio = await wa.sendTemplate(lead.telefono, template, { nombre }, TEMPLATE_LANG)
          await prisma.botConversacion.create({
            data: {
              botLeadId: lead.id, rol: 'bot',
              texto: `[Plantilla: ${template}] Hola ${nombre}, seguimiento automatico.`,
              wamid: wa.wamidDe(envio),
            },
          })
        }
      }

      // Avanzar seguimiento
      if (intento >= MAX_INTENTOS) {
        const estadoFinal = (lead.temperatura || 0) >= 60 ? 'contactado' : 'no_interesado'
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            intentosSeguimiento: intento,
            proximoSeguimiento: estadoFinal === 'contactado' ? new Date(Date.now() + 14 * 24 * 3600000) : null,
            estado: estadoFinal,
            botActivo: false,
          },
        })
        notificarEstadoLead(lead.id, 'unqualified').catch(() => {})
        resultado.perdidos++
      } else {
        const dias = ESPACIADO[intento] || 7
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            intentosSeguimiento: intento,
            proximoSeguimiento: new Date(Date.now() + dias * 24 * 3600000),
          },
        })
      }

      resultado.enviados++
    } catch (e) {
      resultado.fallidos++
      console.error(`[Bot v2 Sender] Error: ${lead.nombre} - ${e.message}`)

      const ERRORES_PERMANENTES = ['#131009', '#131008', '#100']
      if (ERRORES_PERMANENTES.some(c => e.message?.includes(c))) {
        await prisma.botLead.update({
          where: { id: lead.id },
          data: { estado: 'no_interesado', botActivo: false, proximoSeguimiento: null },
        })
        resultado.perdidos++
      } else {
        if (intento >= MAX_INTENTOS) {
          await prisma.botLead.update({
            where: { id: lead.id },
            data: { intentosSeguimiento: intento, proximoSeguimiento: null, estado: 'no_interesado' },
          })
        } else {
          const dias = ESPACIADO[intento] || 7
          await prisma.botLead.update({
            where: { id: lead.id },
            data: { intentosSeguimiento: intento, proximoSeguimiento: new Date(Date.now() + dias * 24 * 3600000) },
          })
        }
      }
    }

    if (i < candidatos.length - 1) {
      await delay(delayAleatorio(delayMin, delayMax))
    }
  }

  return resultado
}
