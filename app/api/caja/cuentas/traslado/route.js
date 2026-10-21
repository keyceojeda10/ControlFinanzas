// app/api/caja/cuentas/traslado/route.js
// Pasar plata de una cuenta a otra (Nequi → Bancolombia, efectivo → banco).
// No cambia el capital del negocio: solo dónde está. Ver `pasarEntreCuentas`.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { pasarEntreCuentas } from '@/lib/capital'
import { formatMoney } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede pasar plata entre cuentas' }, { status: 403 })
  }
  const { organizationId } = session.user

  const body = await request.json().catch(() => ({}))
  const desde = typeof body.desde === 'string' ? body.desde : ''
  const hacia = typeof body.hacia === 'string' ? body.hacia : ''
  const monto = Math.round(Number(body.monto))
  const nota = typeof body.nota === 'string' ? body.nota.trim().slice(0, 200) : ''

  if (!desde || !hacia) return Response.json({ error: 'Elige de qué cuenta sale y a cuál entra' }, { status: 400 })
  if (desde === hacia) return Response.json({ error: 'Las dos cuentas son la misma' }, { status: 400 })
  if (!(monto > 0)) return Response.json({ error: 'Escribe cuánto pasas' }, { status: 400 })

  // Las cuentas son del negocio: nunca el id de otro.
  const ids = [desde, hacia].filter((c) => c !== 'efectivo')
  const metodos = ids.length
    ? await prisma.metodoPago.findMany({ where: { organizationId, id: { in: ids } }, select: { id: true, nombre: true } })
    : []
  if (metodos.length !== ids.length) return Response.json({ error: 'Esa cuenta no existe' }, { status: 400 })
  const nombre = (c) => (c === 'efectivo' ? 'Efectivo' : metodos.find((m) => m.id === c)?.nombre ?? 'otra cuenta')

  const descripcion = `De ${nombre(desde)} a ${nombre(hacia)}${nota ? ` · ${nota}` : ''}`
  const { referenciaId } = await prisma.$transaction((tx) => pasarEntreCuentas(tx, {
    organizationId, desde, hacia, monto, descripcion, creadoPorId: session.user.id,
  }))

  logActividad({
    session,
    accion: 'traslado_entre_cuentas',
    entidadTipo: 'capital',
    entidadId: referenciaId,
    detalle: `Pasó ${formatMoney(monto, session.user.country || 'co')} de ${nombre(desde)} a ${nombre(hacia)}${nota ? ` · ${nota}` : ''}`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })

  return Response.json({ ok: true, referenciaId, descripcion }, { status: 201 })
}
