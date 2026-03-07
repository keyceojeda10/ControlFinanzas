// app/api/auth/reset-password/route.js — Restablecer contraseña con token
import { NextResponse } from 'next/server'
import crypto           from 'crypto'
import bcrypt           from 'bcryptjs'
import { prisma }       from '@/lib/prisma'

const SECRET = process.env.NEXTAUTH_SECRET || 'fallback'

function verificarToken(token) {
  try {
    const [payloadB64, hmac] = token.split('.')
    if (!payloadB64 || !hmac) return null

    const payload = Buffer.from(payloadB64, 'base64url').toString()
    const expectedHmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')

    if (hmac !== expectedHmac) return null

    const data = JSON.parse(payload)
    if (Date.now() > data.exp) return null

    return data
  } catch {
    return null
  }
}

export async function POST(req) {
  const { token, password } = await req.json()

  if (!token || !password) {
    return NextResponse.json({ error: 'Token y contraseña son requeridos' }, { status: 400 })
  }

  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }

  const data = verificarToken(token)
  if (!data) {
    return NextResponse.json({ error: 'El enlace ha expirado o es inválido. Solicita uno nuevo.' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({ where: { id: data.userId } })
  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 })
  }

  const hash = await bcrypt.hash(password, 10)
  await prisma.user.update({
    where: { id: data.userId },
    data: { password: hash },
  })

  return NextResponse.json({ ok: true })
}
