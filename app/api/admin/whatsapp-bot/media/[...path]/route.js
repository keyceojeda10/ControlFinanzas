// app/api/admin/whatsapp-bot/media/[...path]/route.js
// Sirve los archivos de media de WhatsApp (imagenes/audios) SOLO a superadmin.
// La carpeta de uploads NO es publica; este endpoint valida sesion y entrega
// el binario con su content-type. Protege contra path traversal via leerMedia.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { leerMedia } from '@/lib/bot/media-store'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { path: segments } = await params
  const relPath = Array.isArray(segments) ? segments.join('/') : segments
  const media = leerMedia(relPath)
  if (!media) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
  }

  return new NextResponse(media.buffer, {
    status: 200,
    headers: {
      'Content-Type': media.mime,
      'Cache-Control': 'private, max-age=86400',
      'Content-Length': String(media.buffer.length),
    },
  })
}
