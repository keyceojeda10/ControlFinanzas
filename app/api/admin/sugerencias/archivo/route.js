import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'

export const runtime = 'nodejs'

/* Un adjunto de una sugerencia, para verlo en el panel.
 *
 * ⚠ POR QUÉ ESTO NO ES EL AGUJERO DE `public/uploads`. Aquel responde 200 a
 * cualquiera que tenga el enlace, sin cuenta, porque Next sirve `public/` como
 * estático y se salta la sesión. Este archivo vive FUERA de la web y solo sale
 * por aquí: con sesión, con rol de superadmin, y por índice dentro de una
 * sugerencia concreta.
 *
 * ⚠ Y EL ÍNDICE NO ES UNA RUTA. Se pide `?id=<sugerencia>&i=<n>` y el nombre del
 * archivo se saca de lo que se guardó en la fila, nunca de lo que manda el
 * cliente. Si se aceptara un nombre, un `../../.env` saldría por esta puerta.
 */
function carpetaSugerencias() {
  return process.env.SUGERENCIAS_DIR || `${process.cwd()}/.sugerencias`
}

const TIPO = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  heic: 'image/heic', heif: 'image/heif',
  webm: 'audio/webm', ogg: 'audio/ogg', mp4: 'audio/mp4', mpeg: 'audio/mpeg', wav: 'audio/wav',
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (session?.user?.rol !== 'superadmin') {
    return Response.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  const i = Number(searchParams.get('i'))
  if (!id || !Number.isInteger(i) || i < 0) {
    return Response.json({ error: 'Parámetros inválidos' }, { status: 400 })
  }

  const fila = await prisma.sugerencia.findUnique({ where: { id }, select: { archivos: true } })
  if (!fila) return Response.json({ error: 'No encontrada' }, { status: 404 })

  let archivos = []
  try { archivos = JSON.parse(fila.archivos || '[]') } catch {}
  const relativo = archivos[i]
  if (!relativo) return Response.json({ error: 'Adjunto no encontrado' }, { status: 404 })

  // Cinturón y tirantes: aunque el nombre salga de la base, se comprueba que la
  // ruta resuelta siga cayendo dentro del almacén.
  const base = path.resolve(carpetaSugerencias())
  const completo = path.resolve(base, relativo)
  if (!completo.startsWith(base + path.sep)) {
    return Response.json({ error: 'Ruta inválida' }, { status: 400 })
  }

  try {
    const buf = await readFile(completo)
    const ext = completo.split('.').pop()?.toLowerCase()
    return new Response(buf, {
      headers: {
        'Content-Type': TIPO[ext] ?? 'application/octet-stream',
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return Response.json({ error: 'No se pudo leer el archivo' }, { status: 404 })
  }
}
