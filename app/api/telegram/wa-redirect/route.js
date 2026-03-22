// app/api/telegram/wa-redirect/route.js
// Marca lead como contactado y redirige a WhatsApp
// Se usa desde botones inline de Telegram en vez de wa.me directo

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const leadId = searchParams.get('lead')
  const waUrl = searchParams.get('wa') // URL de wa.me completa (encoded)

  if (!waUrl) {
    return NextResponse.redirect('https://wa.me/')
  }

  // Marcar lead como contactado (fire-and-forget, no bloquea el redirect)
  if (leadId) {
    try {
      const lead = await prisma.lead.findUnique({ where: { id: leadId } })
      if (lead && lead.estado === 'nuevo') {
        await prisma.lead.update({
          where: { id: leadId },
          data: { estado: 'contactado' },
        })
      }
    } catch (e) {
      console.error('[wa-redirect] Error marcando contactado:', e)
    }
  }

  return NextResponse.redirect(decodeURIComponent(waUrl))
}
