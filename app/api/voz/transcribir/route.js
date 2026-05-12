import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Servicio de voz no configurado' }, { status: 503 })

  let formData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Audio inválido' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!audio) return NextResponse.json({ error: 'Falta el audio' }, { status: 400 })

  // Reenviar a Groq Whisper
  const groqForm = new FormData()
  groqForm.append('file', audio, 'audio.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'es')
  groqForm.append('response_format', 'json')

  try {
    const res = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: groqForm,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error('[voz/transcribir] Groq error:', err)
      return NextResponse.json({ error: 'Error al transcribir' }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ texto: data.text?.trim() ?? '' })
  } catch (e) {
    console.error('[voz/transcribir] fetch error:', e)
    return NextResponse.json({ error: 'Error de red con Groq' }, { status: 502 })
  }
}
