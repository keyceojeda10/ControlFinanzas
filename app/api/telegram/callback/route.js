import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  answerCallback,
  editMessageReplyMarkup,
  buildPrecioMessage,
  buildRespuestasKeyboard,
  formatNombreSaludo,
  sendMessage,
} from '@/lib/telegram'
import { MENSAJES } from '@/lib/leadMessages'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

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
}

// Telegram Bot webhook — receives button taps from inline keyboards
export async function POST(request) {
  const { searchParams } = new URL(request.url)
  if (WEBHOOK_SECRET && searchParams.get('secret') !== WEBHOOK_SECRET) {
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
      await answerCallback(callbackId, 'Accion no valida')
      return NextResponse.json({ ok: true })
    }

    // Handle response template buttons (resp_como, resp_cuaderno, etc.)
    if (RESP_MAP[action] !== undefined) {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (!lead) {
        await answerCallback(callbackId, 'Lead no encontrado')
        return NextResponse.json({ ok: true })
      }

      const template = MENSAJES.find(m => m.id === RESP_MAP[action])
      if (!template) {
        await answerCallback(callbackId, 'Template no encontrado')
        return NextResponse.json({ ok: true })
      }

      await answerCallback(callbackId, template.label)
      const msg = template.generate({ nombre: lead.nombre })

      // Send as copiable message
      const text = [
        `📋 <b>${template.label}</b> — ${formatNombreSaludo(lead.nombre)}`,
        ``,
        `<code>${msg}</code>`,
      ].join('\n')
      await sendMessage(text)
      return NextResponse.json({ ok: true })
    }

    switch (action) {
      case 'precio': {
        await answerCallback(callbackId, 'Enviando precios...')
        const precioMsg = buildPrecioMessage()
        await sendMessage(precioMsg)
        break
      }

      case 'respuestas': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado')
          break
        }
        await answerCallback(callbackId, 'Respuestas rápidas')
        const keyboard = buildRespuestasKeyboard(leadId)
        await sendMessage(
          `📋 <b>Respuestas rápidas</b> — ${formatNombreSaludo(lead.nombre)}`,
          keyboard
        )
        break
      }

      case 'contactado': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado')
          break
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'contactado' },
        })

        await answerCallback(callbackId, `${formatNombreSaludo(lead.nombre)} marcado como contactado`)

        if (messageId) {
          await editMessageReplyMarkup(messageId, {
            inline_keyboard: [[
              { text: '✅ CONTACTADO', callback_data: 'noop:0' },
            ]],
          })
        }
        break
      }

      case 'descartado': {
        const lead = await prisma.lead.findUnique({ where: { id: leadId } })
        if (!lead) {
          await answerCallback(callbackId, 'Lead no encontrado')
          break
        }

        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'descartado' },
        })

        await answerCallback(callbackId, `${formatNombreSaludo(lead.nombre)} descartado`)

        if (messageId) {
          await editMessageReplyMarkup(messageId, {
            inline_keyboard: [[
              { text: '❌ DESCARTADO', callback_data: 'noop:0' },
            ]],
          })
        }
        break
      }

      case 'noop':
        await answerCallback(callbackId, '')
        break

      default:
        await answerCallback(callbackId, 'Accion desconocida')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[Telegram Callback]', error)
    return NextResponse.json({ ok: true })
  }
}
