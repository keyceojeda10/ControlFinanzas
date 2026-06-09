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
    select: { id: true, nombre: true, email: true, telefono: true, rol: true, avatarId: true, createdAt: true },
  })

  return NextResponse.json(user)
}

export async function PATCH(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const body = await req.json()
  const { nombre, telefono, passwordActual, nuevoPassword, avatarId } = body

  const updates = {}

  // Actualizar nombre
  if (nombre !== undefined) {
    if (!nombre.trim()) return NextResponse.json({ error: 'El nombre no puede estar vacío' }, { status: 400 })
    updates.nombre = nombre.trim()
  }

  // Actualizar teléfono de WhatsApp personal
  if (telefono !== undefined) {
    const limpio = String(telefono).replace(/\D/g, '')
    if (limpio.length < 7 || limpio.length > 15) {
      return NextResponse.json({ error: 'Ingresa un número de WhatsApp válido' }, { status: 400 })
    }
    // Verificar que no lo tenga otro owner (solo si cambia respecto al actual)
    const userActual = await prisma.user.findUnique({ where: { id: session.user.id }, select: { telefono: true } })
    if (userActual?.telefono !== limpio) {
      const otro = await prisma.user.findFirst({
        where: { telefono: limpio, rol: 'owner', id: { not: session.user.id } },
        select: { id: true },
      })
      if (otro) {
        return NextResponse.json({ error: 'Ese número ya está registrado en otra cuenta.' }, { status: 409 })
      }
    }
    updates.telefono = limpio
  }

  // Actualizar avatar
  if (avatarId !== undefined) {
    updates.avatarId = avatarId || null
  }

  // Cambiar contraseña
  if (nuevoPassword !== undefined) {
    if (!passwordActual) return NextResponse.json({ error: 'Debes ingresar tu contraseña actual' }, { status: 400 })
    if (nuevoPassword.length < 8) return NextResponse.json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' }, { status: 400 })

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
