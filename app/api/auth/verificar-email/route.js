// app/api/auth/verificar-email/route.js — Confirma el email del usuario
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

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
