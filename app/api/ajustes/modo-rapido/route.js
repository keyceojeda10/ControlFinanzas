// app/api/ajustes/modo-rapido/route.js — ¿está encendido el modo rápido?
//
// Lo pregunta la app (components/providers/OfflineProvider.jsx) al abrir y al
// volver a la pestaña; el service worker sirve el ARMAZÓN de las pantallas desde
// el teléfono solo si esto dice que sí. Lo mueve el superadmin desde su panel
// (PATCH /api/admin/ajustes). Solo lectura.
//
// Cualquier rol con sesión. Sin sesión: `{ activo: false }` y sin guardar en el
// navegador, o la pantalla de entrada dejaría un «apagado» de 60 s que la
// persona vería justo después de iniciar sesión.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { modoRapidoGlobal } from '@/lib/ajustes-globales'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ activo: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
  const activo = await modoRapidoGlobal()
  return NextResponse.json({ activo }, { headers: { 'Cache-Control': 'private, max-age=60' } })
}
