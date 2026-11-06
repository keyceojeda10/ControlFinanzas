// app/api/tarjeta/aviso/route.js — OFRECERLE LA TARJETA AL DUEÑO, UNA VEZ.
//
// Un negocio que ya usa la app sigue con el recibo de siempre hasta que el dueño
// diga. Quien oculta el saldo ya dijo que no quiere mostrarlo: a ese no se le ofrece.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'

async function dueno() {
  const session = await getServerSession(authOptions)
  return session?.user?.organizationId && session.user.rol === 'owner' ? session : null
}

export async function GET() {
  const session = await dueno()
  if (!session) return Response.json({ mostrar: false })
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: { reciboCliente: true, ocultarSaldoWA: true, avisoTarjetaEn: true },
  })
  return Response.json({
    mostrar: org?.reciboCliente === 'comprobante' && !org.ocultarSaldoWA && !org.avisoTarjetaEn,
  })
}

export async function POST(req) {
  const session = await dueno()
  if (!session) return Response.json({ error: 'No autorizado' }, { status: 403 })
  const { activar } = await req.json().catch(() => ({}))
  const organizationId = session.user.organizationId
  await prisma.organization.update({
    where: { id: organizationId },
    data: { avisoTarjetaEn: new Date(), ...(activar === true ? { reciboCliente: 'tarjeta' } : {}) },
  })
  if (activar === true) {
    logActividad({
      session, accion: 'editar_configuracion', entidadTipo: 'organizacion', entidadId: organizationId,
      detalle: 'Qué recibe el cliente al pagar: el comprobante con su tarjeta',
      ip: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })
  }
  return Response.json({ ok: true })
}
