import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { transcribirAudio } from '@/lib/transcribir'
import { prisma } from '@/lib/prisma'
import { palabrasParaDictado } from '@/lib/busqueda-voz'

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
  /* Al buscar a un cliente por voz, los nombres que ESTA persona puede ver van
     de pista al transcriptor, que si no los escribe a la inglesa («Jason» por
     «Jeison»). Mismo alcance que la búsqueda: el cobrador, solo sus rutas. */
  let prompt = null
  if (formData.get('para') === 'buscar_cliente' && session.user?.organizationId) {
    const { organizationId, rol, rutaIds = [] } = session.user
    const clientes = await prisma.cliente.findMany({
      where: { organizationId, estado: { notIn: ['eliminado'] }, ...(rol === 'cobrador' ? { rutaId: { in: rutaIds } } : {}) },
      select: { nombre: true },
      take: 2000,
    }).catch(() => [])
    prompt = palabrasParaDictado(clientes.map((c) => c.nombre)) || null
  }
  const { texto, error } = await transcribirAudio(audio, { prompt })
  if (error) {
    return NextResponse.json({ error }, { status: error.includes('configurado') ? 503 : 502 })
  }
  return NextResponse.json({ texto })
}
