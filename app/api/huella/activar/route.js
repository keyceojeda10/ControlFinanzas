// app/api/huella/activar/route.js — activar «entrar con huella o cara» en ESTE teléfono.
// POST { paso: 'opciones' }                                  → { opciones, sello }
// POST { paso: 'guardar', sello, respuesta, dispositivo? }   → { ok }
// La cuenta, en lib/huella.js.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { opcionesActivar, guardarActivacion } from '@/lib/huella'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  // En «Ver como» se mira la cuenta de otro: ahí no se le activa nada.
  if (session.user.soloLectura) return Response.json({ error: 'No disponible en «Ver como».' }, { status: 403 })
  const body = await request.json().catch(() => ({}))

  if (body?.paso === 'opciones') {
    const usuario = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, email: true, nombre: true } })
    if (!usuario) return Response.json({ error: 'No autorizado' }, { status: 401 })
    return Response.json(await opcionesActivar(usuario))
  }
  if (body?.paso === 'guardar') {
    const r = await guardarActivacion({ userId: session.user.id, sello: body.sello, respuesta: body.respuesta, dispositivo: body.dispositivo })
    return r.error ? Response.json({ error: r.error }, { status: 400 }) : Response.json({ ok: true })
  }
  return Response.json({ error: 'Paso no válido' }, { status: 400 })
}
