// app/api/admin/whatsapp-bot/leads/[id]/conversacion/route.js — Historial de conversacion
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const mensajes = await prisma.botConversacion.findMany({
    where: { botLeadId: id },
    orderBy: { createdAt: 'asc' },
  })

  return NextResponse.json(mensajes)
}
