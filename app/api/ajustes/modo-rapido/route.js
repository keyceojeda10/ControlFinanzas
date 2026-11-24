// app/api/ajustes/modo-rapido/route.js — ¿está encendido el modo rápido?
//
// Lo pregunta la app (components/providers/OfflineProvider.jsx) al abrir y al
// volver a la pestaña; el service worker sirve el ARMAZÓN de las pantallas desde
// el teléfono solo si esto dice que sí. Lo mueve el superadmin desde su panel
// (PATCH /api/admin/ajustes). Solo lectura.
//
// Cualquier rol con sesión. Sin sesión: `{ activo: false }` y sin guardar en el
// navegador, o la pantalla de entrada dejaría un «apagado» de 60 s que la
// persona vería justo después de iniciar sesión. Si la base falla: 503, no
// «apagado» (ver el `catch`).

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { modoRapidoConCache } from '@/lib/ajustes-globales'

export const runtime = 'nodejs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ activo: false }, { headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const activo = await modoRapidoConCache()
    return NextResponse.json({ activo }, { headers: { 'Cache-Control': 'private, max-age=60' } })
  } catch (err) {
    /* ⚠ Un bache de la base NO es «apagado». Contestar { activo: false } le diría a
       cada teléfono que apague el modo rápido (y el navegador se lo guardaría 60 s).
       503, sin `activo` y sin guardar: la app no decide nada y el service worker se
       queda como estaba (`decidirModoRapido` → null). */
    console.warn('[ajustes/modo-rapido] no se pudo leer:', err?.message || err)
    return NextResponse.json({ error: 'No se pudo leer el ajuste' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
