// app/api/configuracion/perfil/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import bcrypt               from 'bcryptjs'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, nombre: true, email: true, rol: true, createdAt: true },
  })

  return NextResponse.json(user)
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, passwordActual, nuevoPassword } = body

  const updates = {}

  // Actualizar nombre
  if (nombre !== undefined) {
    if (!nombre.trim()) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    updates.nombre = nombre.trim()
  }

  // Cambiar contraseña
  if (nuevoPassword !== undefined) {
    if (!passwordActual) return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 })
    if (nuevoPassword.length < 6) return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 6 caracteres' }, { status: 400 })

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { password: true },
    })

    const ok = await bcrypt.compare(passwordActual, user.password)
    if (!ok) return NextResponse.json({ error: 'La contraseña actual es incorrecta' }, { status: 400 })

    updates.password = await bcrypt.hash(nuevoPassword, 10)
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 })
  }

  await prisma.user.update({ where: { id: session.user.id }, data: updates })

  return NextResponse.json({ ok: true })
}
