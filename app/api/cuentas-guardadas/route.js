// Las cuentas guardadas de la persona que tiene la sesión: guardar, ver sus aparatos, quitar uno.
import { getServerSession } from 'next-auth'
import { headers } from 'next/headers'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { crearCuentaGuardada, llevaPin, pinValido } from '@/lib/cuentas-guardadas'
import { etiquetaDispositivo } from '@/lib/dispositivo'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const body = await request.json().catch(() => ({}))
  if (llevaPin(session.user.rol) && !pinValido(body?.pin)) {
    return Response.json({ error: 'El PIN son 4 números.' }, { status: 400 })
  }
  const ua = (await headers()).get('user-agent') || ''
  const { id, llave } = await crearCuentaGuardada({ userId: session.user.id, rol: session.user.rol, pin: body?.pin, dispositivo: etiquetaDispositivo(ua) })
  return Response.json({
    id, llave,
    userId: session.user.id, nombre: session.user.nombre, rol: session.user.rol,
    orgNombre: session.user.orgNombre ?? null, conPin: llevaPin(session.user.rol),
  }, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const aparatos = await prisma.cuentaGuardada.findMany({
    where: { userId: session.user.id },
    select: { id: true, dispositivo: true, createdAt: true, lastUsedAt: true },
    orderBy: { lastUsedAt: 'desc' },
  })
  return Response.json({ aparatos })
}

export async function DELETE(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const id = new URL(request.url).searchParams.get('id')
  await prisma.cuentaGuardada.deleteMany({ where: { id: String(id ?? ''), userId: session.user.id } })
  return Response.json({ ok: true })
}
