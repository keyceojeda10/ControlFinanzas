// lib/bot/media-store.js — Almacenamiento de media de WhatsApp en disco del VPS
//
// Los media URL de Meta expiran en ~5 min, asi que guardamos los archivos
// (imagenes/audios/documentos que mandan los leads, y los que envia el admin)
// en una carpeta del servidor y los servimos por un endpoint protegido a
// superadmin. Se guarda en DB solo la ruta RELATIVA (mediaPath), no el binario.

import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

// Carpeta base. En el VPS: /home/control-finanzas/uploads/wa
// Configurable por env por si se quiere mover.
const BASE_DIR = process.env.WA_MEDIA_DIR || path.join(process.cwd(), 'uploads', 'wa')

const EXT_POR_MIME = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'audio/ogg': 'ogg',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/amr': 'amr',
  'audio/aac': 'aac',
  'application/pdf': 'pdf',
}

function extDe(mimetype) {
  if (EXT_POR_MIME[mimetype]) return EXT_POR_MIME[mimetype]
  // fallback: tomar el subtipo (image/x -> x), limpiar
  const sub = (mimetype || '').split('/')[1] || 'bin'
  return sub.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'bin'
}

function tipoDe(mimetype) {
  if (!mimetype) return 'document'
  if (mimetype.startsWith('image/')) return 'image'
  if (mimetype.startsWith('audio/')) return 'audio'
  return 'document'
}

// Sub-carpeta por anio-mes para no acumular miles de archivos en un solo dir.
function subdirActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Guarda un buffer/base64 en disco. Devuelve { path (relativo), tipo, mime }.
export function guardarMedia(base64, mimetype) {
  if (!base64) return null
  const sub = subdirActual()
  const dir = path.join(BASE_DIR, sub)
  fs.mkdirSync(dir, { recursive: true })

  const nombre = `${crypto.randomUUID()}.${extDe(mimetype)}`
  const abs = path.join(dir, nombre)
  fs.writeFileSync(abs, Buffer.from(base64, 'base64'))

  // ruta RELATIVA a BASE_DIR, lo que se guarda en DB (mediaPath)
  const rel = `${sub}/${nombre}`
  return { path: rel, tipo: tipoDe(mimetype), mime: mimetype || 'application/octet-stream' }
}

// Lee un archivo por su ruta relativa. Devuelve { buffer, mime } o null.
// Protege contra path traversal (no permite salir de BASE_DIR).
export function leerMedia(relPath) {
  if (!relPath) return null
  const abs = path.normalize(path.join(BASE_DIR, relPath))
  if (!abs.startsWith(path.normalize(BASE_DIR))) return null // traversal
  if (!fs.existsSync(abs)) return null
  const buffer = fs.readFileSync(abs)
  const ext = path.extname(abs).slice(1).toLowerCase()
  const mime = Object.keys(EXT_POR_MIME).find(m => EXT_POR_MIME[m] === ext) || 'application/octet-stream'
  return { buffer, mime }
}

export { tipoDe, extDe }
