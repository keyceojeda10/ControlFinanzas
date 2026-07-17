import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { createPortalToken, portalCookieOptions, COOKIE_NAME } from '@/lib/portal-auth'

export async function POST(request) {
  try {
    const { identificador, pin, organizationId } = await request.json()

    if (!identificador || !pin || !organizationId) {
      return NextResponse.json({ error: 'Faltan datos' }, { status: 400 })
    }

    const valor = identificador.trim()
    const esTelefono = /^\+?\d{7,15}$/.test(valor.replace(/[\s\-]/g, ''))

    let cliente = null

    if (esTelefono) {
      const telLimpio = valor.replace(/\D/g, '')
      const variantes = [telLimpio]
      if (telLimpio.length === 10 && telLimpio.startsWith('3')) variantes.push('57' + telLimpio)
      if (telLimpio.startsWith('57') && telLimpio.length === 12) variantes.push(telLimpio.slice(2))

      cliente = await prisma.cliente.findFirst({
        where: {
          telefono: { in: variantes },
          organizationId,
          portalActivo: true,
          estado: { not: 'eliminado' },
        },
        select: { id: true, nombre: true, organizationId: true, pinPortal: true },
      })
    } else {
      cliente = await prisma.cliente.findFirst({
        where: {
          cedula: valor,
          organizationId,
          portalActivo: true,
          estado: { not: 'eliminado' },
        },
        select: { id: true, nombre: true, organizationId: true, pinPortal: true },
      })
    }

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
