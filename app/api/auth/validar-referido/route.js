// app/api/auth/validar-referido/route.js — Endpoint público para validar código de referido
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url)
    const code = searchParams.get('code')

    if (!code) return NextResponse.json({ valid: false })

    const org = await prisma.organization.findUnique({
      where: { codigoReferido: code },
      select: { id: true, nombre: true },
    })

    if (!org) return NextResponse.json({ valid: false })

    return NextResponse.json({ valid: true, nombreOrg: org.nombre })
  } catch (err) {
    console.error('[validar-referido] Error:', err)
    return NextResponse.json({ valid: false })
  }
}
