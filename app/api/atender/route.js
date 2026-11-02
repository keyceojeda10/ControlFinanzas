// app/api/atender/route.js — la lista «Para atender hoy» y lo que se hizo con cada uno.
//
// Entra quien trae el enlace firmado del día (lib/seguimiento/enlace-atender.js)
// o el superadmin con su sesión. Nada más: la lista lleva nombres y teléfonos.

import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { paraAtender, EVENTO_ATENCION, RESULTADOS } from '@/lib/seguimiento/para-atender'
import { valido } from '@/lib/seguimiento/enlace-atender'
import { mensajePara } from '@/lib/seguimiento/serios'

async function quienEntra(req, cuerpo = null) {
  const u = new URL(req.url)
  const p = cuerpo ?? Object.fromEntries(u.searchParams)
  if (valido({ q: p.q, d: p.d, k: p.k })) return { quien: p.q }
  const session = await getServerSession(authOptions)
  if (session?.user?.rol === 'superadmin') return { quien: 'Carlos', superadmin: true }
  return null
}

export async function GET(req) {
  const acceso = await quienEntra(req)
  if (!acceso) return NextResponse.json({ error: 'Este enlace ya no sirve. Abre el del aviso de hoy.' }, { status: 401 })
  const lista = await paraAtender()
  // El mensaje lo firma quien atiende, no siempre Carlos.
  const filas = lista.map((f) => ({
    ...f,
    mensaje: mensajePara({ momento: f.momento, nombre: f.nombre, prestamos: f.prestamos, diasCobro: f.diasCobro, vence: f.vence, quien: acceso.quien }),
  }))
  return NextResponse.json({ quien: acceso.quien, filas, resultados: RESULTADOS })
}

export async function POST(req) {
  let cuerpo = {}
  try { cuerpo = await req.json() } catch {}
  const acceso = await quienEntra(req, cuerpo)
  if (!acceso) return NextResponse.json({ error: 'Este enlace ya no sirve. Abre el del aviso de hoy.' }, { status: 401 })
  const { organizationId, resultado, nota } = cuerpo
  if (!organizationId || !RESULTADOS[resultado]) return NextResponse.json({ error: 'Falta el negocio o el resultado' }, { status: 400 })
  const existe = await prisma.organization.findUnique({ where: { id: organizationId }, select: { id: true } })
  if (!existe) return NextResponse.json({ error: 'Ese negocio no existe' }, { status: 404 })
  await prisma.evento.create({
    data: {
      organizationId,
      evento: EVENTO_ATENCION,
      metadata: JSON.stringify({ resultado, quien: acceso.quien, nota: typeof nota === 'string' ? nota.slice(0, 300) : null }),
    },
  })
  return NextResponse.json({ ok: true })
}
