import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  answerCallback,
  editMessageText,
  editMessageReplyMarkup,
  buildPrecioMessage,
  formatNombreSaludo,
} from '@/lib/telegram'

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

// Telegram Bot webhook — receives button taps from inline keyboards
export async function POST(request) {
  // Validate secret
  const { searchParams } = new URL(request.url)
  if (WEBHOOK_SECRET && searchParams.get('secret') !== WEBHOOK_SECRET) {
    return NextResponse.json({ ok: true }) // silent 200 to avoid retries
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

    switch (action) {
      case 'precio': {
        await answerCallback(callbackId, 'Enviando precios...')
        const precioMsg = buildPrecioMessage()
        await editMessageText(messageId, null, null) // no-op, we send new message
          .catch(() => {}) // ignore if edit fails
        // Send precio as a new message (easier to copy)
        const { sendMessage } = await import('@/lib/telegram')
        await sendMessage(precioMsg)
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

        // Update the original message to show status
        if (messageId) {
          const originalText = callback.message?.text || ''
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
    return NextResponse.json({ ok: true }) // always 200 to avoid Telegram retries
  }
}
