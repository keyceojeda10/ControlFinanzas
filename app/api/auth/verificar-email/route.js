// app/api/auth/verificar-email/route.js — Verifica email con codigo OTP
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { normalizarEmail } from '@/lib/normalizar-email'

export async function POST(req) {
  try {
    const { email, codigo } = await req.json()

    if (!email || !codigo) {
      return NextResponse.json({ error: 'Email y código son requeridos' }, { status: 400 })
    }

    const emailNorm = normalizarEmail(email)
    const user = await prisma.user.findUnique({ where: { email: emailNorm } })

    if (!user) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    if (user.emailVerificado) {
      return NextResponse.json({ ok: true, already: true })
    }

    if (!user.tokenVerificacion || user.tokenVerificacion !== codigo.trim()) {
      return NextResponse.json({ error: 'Código inválido' }, { status: 400 })
    }

    if (user.tokenExpira && new Date() > new Date(user.tokenExpira)) {
      return NextResponse.json({ error: 'Código expirado. Solicita uno nuevo.' }, { status: 400 })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificado:   true,
        tokenVerificacion: null,
        tokenExpira:       null,
      },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[verificar-email]', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

// Mantener GET para compatibilidad con links viejos que aun no expiran
const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export async function GET(req) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.redirect(`${BASE}/verificar-email?error=token_invalido`)
  }

  const user = await prisma.user.findUnique({ where: { tokenVerificacion: token } })

  if (!user) {
    return NextResponse.redirect(`${BASE}/verificar-email?error=token_invalido`)
  }

  if (user.tokenExpira && new Date() > new Date(user.tokenExpira)) {
    return NextResponse.redirect(`${BASE}/verificar-email?error=token_expirado&email=${encodeURIComponent(user.email)}`)
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerificado:   true,
      tokenVerificacion: null,
      tokenExpira:       null,
    },
  })

  return NextResponse.redirect(`${BASE}/verificar-email?success=1`)
}
