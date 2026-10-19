// app/api/capital/plata-de-hoy — «¿Cuánta plata tienes hoy para prestar?»
// Ver lib/dinero/plata-de-hoy.js (DETALLES-CARTERA #2, decisión de Carlos).
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { asegurarCapital } from '@/lib/capital'
import { anotarPlataDeHoy, faltaLaPlataDeHoy, yaDijoSuPlata } from '@/lib/dinero/plata-de-hoy'
import { getLocalDateStr } from '@/lib/i18n'

// GET — si hay que preguntarle, y la caja de ahora.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ falta: false })
  const { organizationId } = session.user
  const [capital, yaLaDijo] = await Promise.all([
    prisma.capital.findUnique({ where: { organizationId }, select: { saldo: true } }),
    yaDijoSuPlata(prisma, organizationId),
  ])
  const saldo = Math.round(Number(capital?.saldo ?? 0))
  return Response.json({ falta: faltaLaPlataDeHoy({ saldo, yaLaDijo }), saldo })
}

// POST { monto } — deja la caja en lo que el dueño tiene hoy para prestar.
export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el dueño anota su plata' }, { status: 403 })
  const { organizationId, id: usuarioId } = session.user
  const { monto } = await request.json().catch(() => ({}))
  const objetivo = Number(monto)
  if (!Number.isFinite(objetivo) || objetivo < 0) return Response.json({ error: 'Escribe cuánta plata tienes hoy para prestar' }, { status: 400 })

  // «18 oct», a mano: el formato corto del navegador mete «de» según la versión.
  const [, m, d] = getLocalDateStr(session.user.country).split('-')
  const fecha = `${Number(d)} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][Number(m) - 1]}`

  // La fila del capital antes de la transacción (`asegurarCapital`).
  await asegurarCapital(prisma, organizationId)
  const r = await prisma.$transaction((tx) => anotarPlataDeHoy(tx, { organizationId, monto: objetivo, usuarioId, fecha }), { timeout: 30000 })

  logActividad({
    session, accion: 'movimiento_capital', entidadTipo: 'capital', entidadId: organizationId,
    detalle: `Plata para prestar hoy: $${Math.round(objetivo).toLocaleString('es-CO')} (la caja estaba en $${r.antes.toLocaleString('es-CO')})`,
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
  })
  return Response.json({ ok: true, saldo: r.despues, asentado: r.asentado })
}
