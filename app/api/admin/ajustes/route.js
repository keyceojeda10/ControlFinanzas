// app/api/admin/ajustes/route.js — los interruptores globales del panel (superadmin).
//
// GET   → { modoRapido }   lo que hay en la base, sin la caché de 60 s.
// PATCH → { modoRapido: boolean } enciende o apaga el modo rápido PARA TODOS.
//         Deja el registro en AdminLog y hace que la app lo vea en su siguiente
//         pregunta (GET /api/ajustes/modo-rapido), no 60 s después.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { registrarAdminLog } from '@/lib/admin-log'
import { CLAVE_MODO_RAPIDO, leerModoRapido, invalidarAjustesGlobales } from '@/lib/ajustes-globales'

export const runtime = 'nodejs'

async function superadmin() {
  const session = await getServerSession(authOptions)
  return session?.user?.rol === 'superadmin' ? session : null
}

export async function GET() {
  if (!(await superadmin())) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  try {
    return NextResponse.json({ modoRapido: await leerModoRapido() })
  } catch (err) {
    console.error('[admin/ajustes] GET:', err?.message || err)
    return NextResponse.json({ error: 'No se pudo leer el ajuste' }, { status: 500 })
  }
}

export async function PATCH(req) {
  const session = await superadmin()
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 403 })

  const { modoRapido } = await req.json().catch(() => ({}))
  if (typeof modoRapido !== 'boolean') {
    return NextResponse.json({ error: 'Falta modoRapido (true o false)' }, { status: 400 })
  }

  const valor = modoRapido ? '1' : '0'
  const adminId = session.user.id
  try {
    await prisma.ajusteGlobal.upsert({
      where: { clave: CLAVE_MODO_RAPIDO },
      create: { clave: CLAVE_MODO_RAPIDO, valor, actualizadoPorId: adminId },
      update: { valor, actualizadoPorId: adminId },
    })
  } catch (err) {
    console.error('[admin/ajustes] PATCH:', err?.message || err)
    return NextResponse.json({ error: 'No se pudo guardar' }, { status: 500 })
  }
  invalidarAjustesGlobales()

  await registrarAdminLog({
    adminId,
    accion: 'modo_rapido',
    detalle: `Modo rápido para todos: ${modoRapido ? 'encendido' : 'apagado'}`,
  })
  return NextResponse.json({ modoRapido })
}
