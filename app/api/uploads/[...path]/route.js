import { readFile } from 'fs/promises'
import { existsSync } from 'fs'
import path from 'path'

const MIME_TYPES = {
  '.webp': 'image/webp',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
}

export async function GET(request, { params }) {
  try {
    const segments = (await params).path
    if (!segments || segments.length === 0) {
      return new Response('Not found', { status: 404 })
    }

    // Prevenir path traversal
    const joined = segments.join('/')
    if (joined.includes('..') || joined.includes('\\')) {
      return new Response('Forbidden', { status: 403 })
    }

    const filePath = path.join(process.cwd(), 'public', 'uploads', joined)

    // Verificar que el archivo esta dentro de uploads
    const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
    if (!filePath.startsWith(uploadsDir)) {
      return new Response('Forbidden', { status: 403 })
    }

    if (!existsSync(filePath)) {
      return new Response('Not found', { status: 404 })
    }

    const ext = path.extname(filePath).toLowerCase()
    const contentType = MIME_TYPES[ext] || 'application/octet-stream'

    const buffer = await readFile(filePath)

    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch {
    return new Response('Not found', { status: 404 })
  }
}
