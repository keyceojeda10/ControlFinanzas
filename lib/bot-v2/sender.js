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

// Cadencia dentro de la ventana de 24h. Estaba en 1,5h para los intentos 1 y 2,
// lo que producia 3 mensajes en una sola tarde: medido, el 29% de los leads
// recibia 4+ mensajes seguidos sin haber contestado, y el cron los terminaba
// marcando no_interesado. Cuatro horas deja respirar al lead y sigue siendo el
// mismo dia.
const REINTENTO_EN_VENTANA_MS = 4 * 3600 * 1000

// Tope duro de mensajes seguidos del bot sin una sola respuesta del lead. Aunque
// la ventana este abierta, si ya le escribimos 2 veces y no contesto, no se
// insiste mas ese ciclo: se espacia a dias.
const MAX_RACHA_SIN_RESPUESTA = 2

// Que dice cada plantilla, para el historial que lee la IA. Antes se guardaba
// "[Plantilla: X] Hola N, seguimiento automatico.", asi que el agente NO sabia
// que habia dicho y repetia la misma plantilla (a un lead se le mando dos veces).
const DESCRIPCION_PLANTILLA = {
  seguimiento_lead: '(seguimiento automatico: le recorde el sistema y le pregunte si sigue interesado)',
  seguimiento_descubrimiento: '(seguimiento automatico: le pregunte como cobra hoy para entender su necesidad)',
  seguimiento_postlink: '(seguimiento automatico: le pregunte si pudo registrarse con el link que le envie)',
  seguimiento_registro: '(seguimiento automatico: le pregunte como le fue con el registro)',
}

// Cuantos mensajes seguidos del bot hay al final del historial sin respuesta del
// lead en medio.
function rachaSinRespuesta(historial) {
  let n = 0
  for (let i = historial.length - 1; i >= 0; i--) {
    if (historial[i].rol === 'lead') break
    if (historial[i].rol === 'bot') n++
  }
  return n
}

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
            // botActivo SIEMPRE queda true: dejar de escribirle no es dejar de
            // atenderlo. Con botActivo=false el webhook ignoraba al lead y sus
            // mensajes quedaban guardados sin respuesta — medido: 33 leads en 7
            // dias escribieron al vacio, uno de ellos ya registrado y contento.
            botActivo: true,
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
              // Guardar QUE se dijo, no solo el nombre de la plantilla: este texto
              // es el historial que lee el agente para decidir el siguiente mensaje.
              texto: `[Plantilla ${template}] ${DESCRIPCION_PLANTILLA[template] || '(seguimiento automatico)'}`,
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
            // Se agotaron los seguimientos PROACTIVOS: no se le escribe mas
            // (proximoSeguimiento null), pero botActivo queda true para que si el
            // lead responde algun dia, el bot le conteste. Antes se apagaba y la
            // respuesta caia al vacio.
            proximoSeguimiento: estadoFinal === 'contactado' ? new Date(Date.now() + 14 * 24 * 3600000) : null,
            estado: estadoFinal,
            botActivo: true,
          },
        })
        notificarEstadoLead(lead.id, 'unqualified').catch(() => {})
        resultado.perdidos++
      } else {
        const abiertaAun = await ventanaAbierta(lead.id)
        let proximoMs
        // Solo se reintenta el mismo dia si la ventana esta abierta Y todavia no
        // le hemos escrito 2 veces al hilo sin respuesta. Si ya hay racha, se
        // espacia a dias: insistir mas es lo que quemaba al lead y disparaba el
        // throttle de Meta.
        const racha = rachaSinRespuesta(historial) + 1 // +1 por el que acabamos de mandar
        if (abiertaAun && racha < MAX_RACHA_SIN_RESPUESTA) {
          proximoMs = REINTENTO_EN_VENTANA_MS
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

      // Aca SI se apaga el bot: el telefono no sirve, no hay conversacion posible.
      const ERRORES_PERMANENTES = ['#131009', '#131008', '#100', 'TELEFONO_INVALIDO']
      if (e?.permanente === true || ERRORES_PERMANENTES.some(c => e.message?.includes(c))) {
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
