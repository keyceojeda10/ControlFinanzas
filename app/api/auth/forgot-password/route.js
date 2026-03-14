// app/api/auth/forgot-password/route.js — Solicitar reset de contraseña
import { NextResponse } from 'next/server'
import crypto           from 'crypto'
import { prisma }       from '@/lib/prisma'
import { enviarEmail, emailResetPassword } from '@/lib/email'
import { forgotLimiter, getClientIp } from '@/lib/rate-limit'

const SECRET = process.env.NEXTAUTH_SECRET
if (!SECRET) throw new Error('NEXTAUTH_SECRET no configurado')

function generarToken(userId) {
  const payload = JSON.stringify({ userId, exp: Date.now() + 3600000 }) // 1 hora
  const hmac = crypto.createHmac('sha256', SECRET).update(payload).digest('hex')
  const token = Buffer.from(payload).toString('base64url') + '.' + hmac
  return token
}

export async function POST(req) {
  // Rate limiting: 3 intentos por IP por hora
  const ip = getClientIp(req)
  const rl = forgotLimiter(ip)
  if (!rl.ok) {
    return NextResponse.json({ ok: true }) // No revelar que fue rate limited
  }

  const { email } = await req.json()

  if (!email?.trim()) {
    return NextResponse.json({ error: 'El correo es requerido' }, { status: 400 })
  }

  const user = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: { id: true, nombre: true, email: true, activo: true },
  })

  // Siempre responder con éxito (no revelar si el email existe)
  if (!user || !user.activo) {
    return NextResponse.json({ ok: true })
  }

  const token = generarToken(user.id)
  const resetUrl = `${process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'}/reset-password?token=${token}`

  const { subject, html } = emailResetPassword({
    nombre: user.nombre,
    resetUrl,
  })

  await enviarEmail({ to: user.email, subject, html })

  return NextResponse.json({ ok: true })
}
