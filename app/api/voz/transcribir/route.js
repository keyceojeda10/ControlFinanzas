import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { transcribirAudio } from '@/lib/transcribir'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let formData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Audio inválido' }, { status: 400 })
  }

  const audio = formData.get('audio')
  if (!audio) return NextResponse.json({ error: 'Falta el audio' }, { status: 400 })

  // La llamada a Groq vive en `lib/transcribir`: la campaña de sugerencias hace
  // exactamente lo mismo y no tiene sentido tener dos copias de la clave, el
  // modelo y el idioma.
  const { texto, error } = await transcribirAudio(audio)
  if (error) {
    return NextResponse.json({ error }, { status: error.includes('configurado') ? 503 : 502 })
  }
  return NextResponse.json({ texto })
}
