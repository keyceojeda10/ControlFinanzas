// lib/bot-v2/sender.js — Envio de seguimientos (reutiliza whatsapp-cloud del v1)

import { prisma } from '@/lib/prisma'
import * as wa from '../bot/whatsapp-cloud'
import { generarSeguimiento } from './agente.js'
import { notificarEstadoLead } from '../bot/notificar-meta'

const delay = (ms) => new Promise(r => setTimeout(r, ms))

const ESPACIADO = [1, 3]
const MAX_INTENTOS = 3        // leads que SI respondieron (interactuaron)
const MAX_INTENTOS_FRIO = 2   // leads que nunca respondieron: menos toques por
                              // plantilla para no gatillar el throttle de Meta
                              // (error 131049 "healthy ecosystem engagement")
const VENTANA_MS = 24 * 3600 * 1000

const TEMPLATE_SEGUIMIENTO = process.env.WHATSAPP_TEMPLATE_SEGUIMIENTO || 'seguimiento_lead'
const TEMPLATE_DESCUBRIMIENTO = 'seguimiento_descubrimiento'
const TEMPLATE_POSTLINK = 'seguimiento_postlink'
const TEMPLATE_REGISTRO = 'seguimiento_registro'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

function elegirPlantilla(historial) {
  const leadRespondio = historial.some(m => m.rol === 'lead')
  const textosBot = historial.filter(m => m.rol === 'bot').map(m => (m.texto || '')).join(' ')
  const linkEnviado = textosBot.includes('app.control-finanzas.com/registro')

  if (linkEnviado) return TEMPLATE_POSTLINK
  if (leadRespondio) return TEMPLATE_DESCUBRIMIENTO
  return TEMPLATE_SEGUIMIENTO
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
    let maxIntentos = MAX_INTENTOS

    try {
      const historial = await prisma.botConversacion.findMany({
        where: { botLeadId: lead.id },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
      historial.reverse()

      // Un lead que nunca respondio recibe menos seguimientos: insistirle 3
      // veces por plantilla de marketing es exactamente lo que Meta penaliza.
      const yaInteractuo = historial.some(m => m.rol === 'lead')
      maxIntentos = yaInteractuo ? MAX_INTENTOS : MAX_INTENTOS_FRIO

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
          const template = elegirPlantilla(historial)
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
      if (intento >= maxIntentos) {
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
        const abiertaAun = await ventanaAbierta(lead.id)
        let proximoMs
        if (abiertaAun && intento <= 2) {
          proximoMs = 1.5 * 3600000
        } else {
          const dias = ESPACIADO[intento] || 7
          proximoMs = dias * 24 * 3600000
        }
        await prisma.botLead.update({
          where: { id: lead.id },
          data: {
            intentosSeguimiento: intento,
            proximoSeguimiento: new Date(Date.now() + proximoMs),
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
        if (intento >= maxIntentos) {
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
