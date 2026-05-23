// app/api/admin/whatsapp-bot/followup/route.js — Trigger manual de seguimientos
import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { enviarSeguimientos } from '@/lib/bot/sender'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  try {
    const resultado = await enviarSeguimientos(3)
    return NextResponse.json(resultado)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
