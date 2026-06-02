// app/api/admin/whatsapp-bot/leads/[id]/send/route.js
// El superadmin envia un mensaje MANUAL a un chat (texto o media).
// - Solo dentro de la ventana de 24h (Meta exige plantilla fuera de ella).
// - Guarda el mensaje en BotConversacion con rol: 'admin'.
// - Acepta JSON { texto } o multipart/form-data con un archivo (campo 'file').

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { guardarMedia, tipoDe } from '@/lib/bot/media-store'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

const execAsync = promisify(exec)
const VENTANA_MS = 24 * 3600 * 1000

// Meta NO acepta audio/webm (lo que graba Chrome). Convertimos cualquier audio
// a ogg/opus con ffmpeg (instalado en el VPS) para garantizar compatibilidad.
async function convertirAudioAOgg(buffer, mimeOriginal) {
  // Si ya es un formato que Meta acepta y no es webm, no convertir.
  const ok = ['audio/ogg', 'audio/opus', 'audio/mpeg', 'audio/mp4', 'audio/aac', 'audio/amr']
  if (ok.includes(mimeOriginal)) return { buffer, mime: mimeOriginal }

  const tmp = os.tmpdir()
  const inPath = path.join(tmp, `wa-in-${crypto.randomUUID()}`)
  const outPath = path.join(tmp, `wa-out-${crypto.randomUUID()}.ogg`)
  try {
    fs.writeFileSync(inPath, buffer)
    await execAsync(`ffmpeg -y -i "${inPath}" -c:a libopus -b:a 32k "${outPath}"`, { timeout: 30000 })
    const out = fs.readFileSync(outPath)
    return { buffer: out, mime: 'audio/ogg' }
  } finally {
    fs.existsSync(inPath) && fs.unlinkSync(inPath)
    fs.existsSync(outPath) && fs.unlinkSync(outPath)
  }
}

async function ventanaAbierta(botLeadId) {
  const ultimoLead = await prisma.botConversacion.findFirst({
    where: { botLeadId, rol: 'lead' },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true },
  })
  if (!ultimoLead) return false
  return Date.now() - new Date(ultimoLead.createdAt).getTime() < VENTANA_MS
}

export async function POST(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.rol !== 'superadmin') {
    return NextResponse.json({ error: 'No autorizado' }, { status: 403 })
  }

  const { id } = await params
  const lead = await prisma.botLead.findUnique({ where: { id } })
  if (!lead) return NextResponse.json({ error: 'Lead no encontrado' }, { status: 404 })

  // La ventana de 24h solo aplica a texto/media libre. Si esta cerrada, avisar.
  const abierta = await ventanaAbierta(id)
  if (!abierta) {
    return NextResponse.json({
      error: 'ventana_cerrada',
      mensaje: 'El lead no escribe hace mas de 24h. WhatsApp solo permite enviar una plantilla aprobada fuera de ese plazo.',
    }, { status: 409 })
  }

  const contentType = request.headers.get('content-type') || ''

  try {
    // --- Envio de archivo (multipart) ---
    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData()
      const file = form.get('file')
      const caption = (form.get('texto') || '').toString()
      if (!file || typeof file === 'string') {
        return NextResponse.json({ error: 'Falta el archivo' }, { status: 400 })
      }
      let mimetype = file.type || 'application/octet-stream'
      const tipo = tipoDe(mimetype) // image | audio | document
      let buffer = Buffer.from(await file.arrayBuffer())

      // Si es audio, convertir a ogg/opus (Meta no acepta webm de Chrome)
      if (tipo === 'audio') {
        const conv = await convertirAudioAOgg(buffer, mimetype)
        buffer = conv.buffer
        mimetype = conv.mime
      }

      // Subir a Meta y enviar
      const mediaId = await wa.uploadMedia(buffer, mimetype)
      await wa.sendMedia(lead.telefono, mediaId, tipo, caption)

      // Guardar copia en disco para el panel
      const saved = guardarMedia(buffer.toString('base64'), mimetype)
      await prisma.botConversacion.create({
        data: {
          botLeadId: id, rol: 'admin', texto: caption || `[${tipo}]`, tipoMensaje: tipo,
          mediaPath: saved?.path || null, mediaTipo: saved?.tipo || tipo, mediaMime: saved?.mime || mimetype,
        },
      })
      return NextResponse.json({ ok: true, tipo })
    }

    // --- Envio de texto (JSON) ---
    const body = await request.json().catch(() => ({}))
    const texto = (body.texto || '').toString().trim()
    if (!texto) return NextResponse.json({ error: 'Texto vacio' }, { status: 400 })

    await wa.sendText(lead.telefono, texto)
    await prisma.botConversacion.create({
      data: { botLeadId: id, rol: 'admin', texto, tipoMensaje: 'chat' },
    })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('[WA admin send] Error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
