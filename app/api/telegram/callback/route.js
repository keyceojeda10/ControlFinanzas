import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  answerCallback,
  editMessageReplyMarkup,
  buildPrecioMessage,
  buildRespuestasKeyboard,
  buildFirstMessage,
  whatsappLink,
  formatNombreSaludo,
  sendMessage,
} from '@/lib/telegram'
import { MENSAJES } from '@/lib/leadMessages'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
const NOTIF_WEBHOOK_SECRET = process.env.TELEGRAM_NOTIF_WEBHOOK_SECRET

// Map callback actions to message template IDs
const RESP_MAP = {
  resp_como: 2,      // Cómo funciona
  resp_cuaderno: 3,  // Usa cuaderno
  resp_excel: 4,     // Usa Excel
  resp_wa: 5,        // Usa WhatsApp/notas
  resp_otraapp: 6,   // Usa otra app
  resp_solo: 8,      // Cobra solo
  resp_cobr: 9,      // Tiene cobradores
  resp_reg: 10,      // Ya se registró
  resp_web: 11,      // No es app, es sistema web
  resp_perm: 12,     // Permisos de cobradores
  resp_seg: 13,      // Seguridad / robo de celular
  resp_video: 14,    // Video / demostración
  resp_cobro: 15,    // Sin cobros adicionales
  resp_otro: 19,     // Otro método (genérico)
  resp_post: 20,     // Post-registro (ya verificó correo)
}

// Telegram Bot webhook — receives button taps from inline keyboards
// Supports both bots via ?bot=leads|notif query param
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  const botType = searchParams.get('bot') || 'leads'
  const secret = searchParams.get('secret')

  // Validate secret based on which bot is calling
  const expectedSecret = botType === 'notif' ? NOTIF_WEBHOOK_SECRET : WEBHOOK_SECRET
  if (expectedSecret && secret !== expectedSecret) {
    return NextResponse.json({ ok: true })
  }

  try {
    const body = await request.json()
    const callback = body.callback_query
    if (!callback) return NextResponse.json({ ok: true })

    const callbackId = callback.id
    const data = callback.data || ''
    const messageId = callback.message?.message_id

    const [action, leadId] = data.split(':')
    if (!action || !leadId) {
      await answerCallback(callbackId, 'Accion no valida', botType)
      return NextResponse.json({ ok: true })
    }

    // Handle response template buttons (resp_como, resp_cuaderno, etc.)
    if (RESP_MAP[action] !== undefined) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (!lead) {
        await answerCallback(callbackId, 'Lead no encontrado', botType)
        return NextResponse.json({ ok: true })
      }

      const template = MENSAJES.find(m => m.id === RESP_MAP[action])
      if (!template) {
        await answerCallback(callbackId, 'Template no encontrado', botType)
        return NextResponse.json({ ok: true })
      }

      await answerCallback(callbackId, template.label, botType)
      const msg = template.generate({ nombre: lead.nombre })

      // Send as copiable message (to the same bot/chat that triggered it)
      const text = [
        `📋 <b>${template.label}</b> — ${formatNombreSaludo(lead.nombre)}`,
        ``,
        `<code>${msg}</code>`,
      ].join('\n')
      await sendMessage(text, null, botType)
      return NextResponse.json({ ok: true })
    }

    switch (action) {
      case 'precio': {
        await answerCallback(callbackId, 'Enviando precios...', botType)
        const precioMsg = buildPrecioMessage()
        await sendMessage(precioMsg, null, botType)
        break
      }

      case 'respuestas': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado', botType)
          break
        }
        await answerCallback(callbackId, 'Respuestas rápidas', botType)
        const keyboard = buildRespuestasKeyboard(leadId)
        await sendMessage(
          `📋 <b>Respuestas rápidas</b> — ${formatNombreSaludo(lead.nombre)}`,
          keyboard,
          botType
        )
        break
      }

      case 'contactado': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado', botType)
          break
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'contactado' },
        })

        await answerCallback(callbackId, `${formatNombreSaludo(lead.nombre)} marcado como contactado`, botType)

        // Mantener todos los botones pero agregar indicador de contactado
        if (messageId) {
          const waMsg = buildFirstMessage(lead.nombre)
          const tel = (lead.telefono || '').replace(/\D/g, '')
          const waLink = tel ? whatsappLink(tel, waMsg) : null

          const rows = []
          if (waLink) {
            rows.push([
              { text: '📱 WhatsApp', url: waLink },
              { text: '💬 Respuestas', callback_data: `respuestas:${leadId}` },
            ])
          }
          rows.push([
            { text: '💰 Precio', callback_data: `precio:${leadId}` },
            { text: '✅ CONTACTADO', callback_data: `noop:${leadId}` },
            { text: '❌ Descartar', callback_data: `descartado:${leadId}` },
          ])

          await editMessageReplyMarkup(messageId, { inline_keyboard: rows }, botType)
        }
        break
      }

      case 'descartado': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado', botType)
          break
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'descartado' },
        })

        await answerCallback(callbackId, `${formatNombreSaludo(lead.nombre)} descartado`, botType)

        if (messageId) {
          await editMessageReplyMarkup(messageId, {
            inline_keyboard: [[
              { text: '❌ DESCARTADO', callback_data: 'noop:0' },
            ]],
          }, botType)
        }
        break
      }

      case 'noop':
        await answerCallback(callbackId, '', botType)
        break

      default:
        await answerCallback(callbackId, 'Accion desconocida', botType)
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Callback]', error)
    return NextResponse.json({ ok: true })
  }
}
