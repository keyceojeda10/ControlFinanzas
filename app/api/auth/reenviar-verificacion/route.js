// app/api/auth/reenviar-verificacion/route.js — Reenvía el email de verificación
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { enviarEmail, emailVerificacion } from '@/lib/email'
import { rateLimit, getClientIp } from '@/lib/rate-limit'

const reenvioLimiter = rateLimit('reenvio-verificacion', 3, 60 * 60 * 1000) // 3/hora

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export async function POST(req) {
  try {
    const ip = getClientIp(req)
    const rl = reenvioLimiter(ip)
    if (!rl.ok) return NextResponse.json({ ok: true }) // silencioso

    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const emailNorm = email.trim().toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: emailNorm } })

    // Responder siempre OK para no filtrar si el email existe
    if (!user || user.emailVerificado) {
      return NextResponse.json({ ok: true })
    }

    const tokenVerificacion = crypto.randomBytes(32).toString('hex')
    const tokenExpira = new Date(Date.now() + 24 * 60 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVerificacion, tokenExpira },
    })

    const link = `${BASE}/api/auth/verificar-email?token=${tokenVerificacion}`
    const { subject, html } = emailVerificacion({ nombre: user.nombre, link })
    await enviarEmail({ to: emailNorm, subject, html })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reenviar-verificacion]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
