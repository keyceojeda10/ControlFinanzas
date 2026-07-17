import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createPortalToken, portalCookieOptions, COOKIE_NAME } from '@/lib/portal-auth'

export async function POST(request) {
  try {
    const { cedula, pin, organizationId } = await request.json()

    if (!cedula || !pin || !organizationId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const cliente = await prisma.cliente.findFirst({
      where: {
        cedula: cedula.trim(),
        organizationId,
        portalActivo: true,
        estado: { not: 'eliminado' },
      },
      select: {
        id: true,
        nombre: true,
        organizationId: true,
        pinPortal: true,
        estado: true,
      },
    })

    if (!cliente || !cliente.pinPortal) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const pinOk = await bcrypt.compare(pin, cliente.pinPortal)
    if (!pinOk) {
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    prisma.cliente.update({
      where: { id: cliente.id },
      data: { ultimoAccesoPortal: new Date() },
    }).catch(() => {})

    const token = await createPortalToken(cliente)

    const response = NextResponse.json({ ok: true, nombre: cliente.nombre })
    response.cookies.set(COOKIE_NAME, token, portalCookieOptions())
    return response
  } catch (err) {
    console.error('[portal/auth]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, '', { ...portalCookieOptions(), maxAge: 0 })
  return response
}
