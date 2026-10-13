// app/api/seguimiento/oferta-vista/route.js — el dueño VIO la ventana del 35 %.
//
// Se apunta en el servidor y no en el teléfono: la ventana se cuenta por
// negocio, no por aparato. Si la vio en el teléfono no le vuelve a salir en el
// PC. Vuelve a la semana o al entrar en los 3 últimos días del plan (regla en
// lib/oferta-nequi-aviso.js, pedido del dueño el 12 oct 2026: «no quiero que se
// vea spam»). Una fila por día como mucho.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST() {
  const session = await getServerSession(authOptions)
  const organizationId = session?.user?.organizationId
  if (!organizationId || session.user.rol !== 'owner') return Response.json({ ok: false }, { status: 401 })
  const dia = new Date(Date.now() - 5 * 3600e3).toISOString().slice(0, 10)
  try {
    await prisma.envioSeguimiento.create({
      data: { organizationId, caso: 'oferta_app', claveCaso: `oferta_app:${organizationId}`, paso: `visto:${dia}`, canal: 'app', ok: true },
    })
  } catch (e) {
    if (e?.code !== 'P2002') throw e // ya la había visto hoy
  }
  return Response.json({ ok: true })
}
