// app/api/sesiones/route.js — Registra/actualiza sesión activa del usuario
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { headers } from 'next/headers'

function parseDispositivo(ua) {
  if (!ua) return 'Desconocido'
  const lower = ua.toLowerCase()
  if (lower.includes('iphone')) return 'iPhone'
  if (lower.includes('ipad')) return 'iPad'
  if (lower.includes('android')) {
    if (lower.includes('mobile')) return 'Android'
    return 'Tablet Android'
  }
  if (lower.includes('macintosh') || lower.includes('mac os')) return 'Mac'
  if (lower.includes('windows')) return 'Windows'
  if (lower.includes('linux')) return 'Linux'
  return 'Otro'
}

function parseBrowser(ua) {
  if (!ua) return ''
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('OPR/') || ua.includes('Opera')) return 'Opera'
  if (ua.includes('Chrome/') && !ua.includes('Edg/')) return 'Chrome'
  if (ua.includes('Safari/') && !ua.includes('Chrome/')) return 'Safari'
  if (ua.includes('Firefox/')) return 'Firefox'
  return ''
}

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const hdrs = await headers()
  const ip = hdrs.get('x-forwarded-for')?.split(',')[0]?.trim()
    || hdrs.get('x-real-ip')
    || 'desconocida'
  const userAgent = hdrs.get('user-agent') || ''
  const dispositivo = parseDispositivo(userAgent)
  const browser = parseBrowser(userAgent)
  const label = browser ? `${dispositivo} · ${browser}` : dispositivo

  const userId = session.user.id
  const organizationId = session.user.organizationId || null

  // Buscar sesión existente del mismo user+ip+dispositivo (últimas 24h)
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const existente = await prisma.sesionActiva.findFirst({
    where: {
      userId,
      ip,
      dispositivo: label,
      lastActivityAt: { gte: hace24h },
    },
    orderBy: { lastActivityAt: 'desc' },
  })

  if (existente) {
    await prisma.sesionActiva.update({
      where: { id: existente.id },
      data: { lastActivityAt: new Date() },
    })
  } else {
    await prisma.sesionActiva.create({
      data: { userId, organizationId, ip, userAgent, dispositivo: label, lastActivityAt: new Date() },
    })
  }

  return NextResponse.json({ ok: true })
}
