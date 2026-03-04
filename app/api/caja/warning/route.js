// app/api/caja/warning/route.js - Endpoint para advertiencia de cierre de caja

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// Retorna si hay una advertencia activa de cierre de caja
// y los minutos restantes hasta el cierre automático
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const now = new Date()
  
  // Colombia timezone: UTC-5
  const colombiaNow = new Date(now.getTime() - 5 * 60 * 60 * 1000)
  const hour = colombiaNow.getHours()
  const minutes = colombiaNow.getMinutes()

  // Si es entre las 11:45 PM y 11:59 PM (hora Colombia), mostrar advertencia
  // 23:45 = 23*60 + 45 = 1385 minutos
  // 23:59 = 23*60 + 59 = 1439 minutos
  const currentMinutes = hour * 60 + minutes
  
  // Advertencia entre 23:45 y 23:59 (15 minutos antes de medianoche)
  const showWarning = currentMinutes >= 1385 && currentMinutes < 1440
  
  // Minutos restantes hasta cierre (a las 23:59 = 1440 minutos)
  const minutesUntilClose = showWarning ? (1440 - currentMinutes) : 0

  return Response.json({
    showWarning,
    minutesUntilClose: showWarning ? Math.max(1, minutesUntilClose) : 0,
    autoCloseTime: '23:59', // Colombia
  })
}

// Endpoint para activar manualmente la advertencia (usado por scheduler)
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    // Allow cron job (no session required for POST)
  }

  // Este endpoint es llamado por el scheduler externo
  // Solo retorna éxito
  return Response.json({ 
    success: true, 
    message: 'Warning activated',
    colombiaTime: new Date(new Date().getTime() - 5 * 60 * 60 * 1000).toISOString()
  })
}
