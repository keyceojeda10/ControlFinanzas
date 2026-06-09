// app/api/auth/reenviar-verificacion/route.js — Reenvía el email de verificación
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enviarEmail, emailVerificacion } from '@/lib/email'
import { rateLimit, getClientIp } from '@/lib/rate-limit'
import { normalizarEmail } from '@/lib/normalizar-email'
import { sendTemplate } from '@/lib/bot/whatsapp-cloud'

const reenvioLimiter = rateLimit('reenvio-verificacion', 3, 60 * 60 * 1000) // 3/hora

export async function POST(req) {
  try {
    const ip = getClientIp(req)
    const rl = reenvioLimiter(ip)
    if (!rl.ok) return NextResponse.json({ ok: true }) // silencioso

    const body = await req.json()
    const { email, canal } = body
    if (!email) return NextResponse.json({ error: 'Email requerido' }, { status: 400 })

    const emailNorm = normalizarEmail(email)
    const user = await prisma.user.findUnique({ where: { email: emailNorm } })

    // Responder siempre OK para no filtrar si el email existe
    if (!user || user.emailVerificado) {
      return NextResponse.json({ ok: true })
    }

    const tokenVerificacion = String(Math.floor(100000 + Math.random() * 900000))
    const tokenExpira = new Date(Date.now() + 30 * 60 * 1000)

    await prisma.user.update({
      where: { id: user.id },
      data: { tokenVerificacion, tokenExpira },
    })

    // Enviar OTP por WhatsApp si el canal elegido es whatsapp
    const canalElegido = canal === 'email' ? 'email' : 'whatsapp'
    if (canalElegido === 'whatsapp' && user.telefono) {
      sendTemplate(user.telefono, 'verificacion_otp', [tokenVerificacion], 'es')
        .catch(e => console.error('[WA OTP reenvio]', e.message))
    }

    // Siempre enviar email como respaldo
    const { subject, html } = emailVerificacion({ nombre: user.nombre, codigo: tokenVerificacion })
    await enviarEmail({ to: emailNorm, subject, html })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[reenviar-verificacion]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
