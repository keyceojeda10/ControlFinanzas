// app/api/admin/whatsapp-bot/chats/route.js
// Bandeja de chats tipo WhatsApp: leads ordenados por ULTIMA ACTIVIDAD, con su
// ultimo mensaje (preview), temperatura, estado, bot on/off y si esta registrado.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getTelefonosRegistrados, estaRegistrado } from '@/lib/bot/conversion'

const TEMP_CALIENTE = 60

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const filtro = searchParams.get('filtro') || 'todos' // todos | calientes | bot_off | sin_contestar
  const busqueda = searchParams.get('q')
  const limite = Math.min(parseInt(searchParams.get('limite') || '80'), 200)

  const where = { estado: { not: 'bloqueado' } }
  if (busqueda) {
    where.OR = [
      { nombre: { contains: busqueda } },
      { telefono: { contains: busqueda } },
    ]
  }
  if (filtro === 'calientes') where.temperatura = { gte: TEMP_CALIENTE }
  if (filtro === 'bot_off') where.botActivo = false

  // Traer leads con su ultimo mensaje (1) para preview y para ordenar por actividad.
  const leads = await prisma.botLead.findMany({
    where,
    take: limite,
    orderBy: { updatedAt: 'desc' },
    include: {
      conversaciones: { orderBy: { createdAt: 'desc' }, take: 3 },
    },
  })

  const registrados = await getTelefonosRegistrados()

  let items = leads.map(l => {
    const ultimo = l.conversaciones[0] || null
    const ultimoLead = l.conversaciones.find(m => m.rol === 'lead')
    let ventanaMs = 0
    if (ultimoLead) {
      ventanaMs = Math.max(0, 24 * 3600000 - (Date.now() - new Date(ultimoLead.createdAt).getTime()))
    }
    return {
      id: l.id,
      nombre: l.nombre,
      telefono: l.telefono,
      estado: l.estado,
      temperatura: l.temperatura,
      botActivo: l.botActivo,
      alertado: l.alertado,
      registrado: estaRegistrado(l.telefono, registrados),
      ventanaMs,
      ultimoMensaje: ultimo ? {
        rol: ultimo.rol,
        texto: ultimo.texto?.slice(0, 80) || '',
        tipoMensaje: ultimo.tipoMensaje,
        createdAt: ultimo.createdAt,
      } : null,
      ultimaActividad: ultimo ? ultimo.createdAt : l.createdAt,
    }
  })

  // filtro "sin_contestar": ultimo mensaje fue del lead (espera respuesta)
  if (filtro === 'sin_contestar') {
    items = items.filter(i => i.ultimoMensaje && i.ultimoMensaje.rol === 'lead')
  }

  // Ordenar por ultima actividad (mensaje mas reciente arriba, como WhatsApp)
  items.sort((a, b) => new Date(b.ultimaActividad) - new Date(a.ultimaActividad))

  return NextResponse.json({ chats: items, total: items.length })
}
