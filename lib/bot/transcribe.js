// lib/bot/transcribe.js — Transcripcion de notas de voz con Groq Whisper

const GROQ_API_KEY = process.env.GROQ_API_KEY

function extensionDe(mimetype = '') {
  if (mimetype.includes('ogg')) return 'ogg'
  if (mimetype.includes('mpeg') || mimetype.includes('mp3')) return 'mp3'
  if (mimetype.includes('wav')) return 'wav'
  if (mimetype.includes('mp4') || mimetype.includes('m4a')) return 'm4a'
  if (mimetype.includes('webm')) return 'webm'
  return 'ogg'
}

export async function transcribirAudio(base64, mimetype) {
  if (!GROQ_API_KEY) {
    console.error('[Bot Transcribe] Falta GROQ_API_KEY.')
    return { texto: null, costoUsd: 0, segundos: 0 }
  }
  if (!base64) return { texto: null, costoUsd: 0, segundos: 0 }

  try {
    const buffer = Buffer.from(base64, 'base64')
    const ext = extensionDe(mimetype)
    const blob = new Blob([buffer], { type: mimetype || 'audio/ogg' })

    const formData = new FormData()
    formData.append('file', blob, `nota-voz.${ext}`)
    formData.append('model', 'whisper-large-v3-turbo')
    formData.append('language', 'es')
    formData.append('response_format', 'verbose_json')

    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
      body: formData,
      signal: AbortSignal.timeout(30000),
    })

    const resp = await res.json()
    const texto = (resp.text || '').trim() || null
    const segundos = resp.duration || Math.max(1, Math.round(buffer.length / 2200))
    // Groq whisper es gratis o muy barato, pero registramos un costo estimado
    const costoUsd = +((segundos / 60) * 0.006).toFixed(6)

    return { texto, costoUsd, segundos: Math.round(segundos) }
  } catch (e) {
    console.error('[Bot Transcribe] Error:', e.message)
    return { texto: null, costoUsd: 0, segundos: 0 }
  }
}
