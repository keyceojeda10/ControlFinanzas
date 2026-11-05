// app/api/pagos/wompi/nequi/route.js — dejar el Nequi guardado para que el
// plan se cobre solo.
//
// ══ POR QUÉ ESTE CAMINO Y NO EL WIDGET ═════════════════════════════════════
//
// El widget de Wompi en modo tokenización no cierra el círculo en Colombia.
// Probado el 1 sep 2026 con un Nequi de verdad: el push llegó al teléfono, pero
// el POST que el widget debía hacer a `/api/pagos/wompi/token` **nunca llegó**.
// No está documentado para Colombia y no hay forma de depurar lo que hace por
// dentro.
//
// Esto va entero por el servidor, con API documentada, y la persona solo tiene
// que escribir su número y aprobar en su app:
//
//   POST  → pide el token y le llega el push a Nequi
//   GET   → dice en qué va; cuando está aprobado, guarda el medio de pago
//
// ⚠ Y ES EL CAMINO QUE IMPORTA: de las últimas doce suscripciones cobradas por
// Wompi, ocho fueron con Nequi y solo una con tarjeta.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { pedirTokenNequi, estadoTokenNequi, wompiConfigurado } from '@/lib/wompi'
import { confirmarNequi, apuntarPedidoNequi } from '@/lib/pagos/confirmar-nequi'

/** Guardar un medio de pago compromete plata del negocio: solo el dueño. */
async function soloElDueno() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) }
  }
  if (session.user.rol !== 'owner') {
    return { error: NextResponse.json({ error: 'Solo el dueño puede guardar el medio de pago' }, { status: 403 }) }
  }
  if (!wompiConfigurado()) {
    return { error: NextResponse.json({ error: 'Los pagos no están configurados' }, { status: 503 }) }
  }
  return { session }
}

/* ── Paso 1: pedir la autorización ────────────────────────────────────────
 * Devuelve el id del token. Nace PENDING: todavía no sirve para cobrar, hay que
 * esperar a que la persona toque «Aceptar» en su app. */
export async function POST(req) {
  const { error, session } = await soloElDueno()
  if (error) return error

  const { telefono, plan } = await req.json().catch(() => ({}))
  /* Si ya había pedido una y la aprobó, no se le manda otra: esa es la que vale,
     y pedir otra encima la dejaría olvidada. La guarda el sondeo de la pantalla. */
  const previo = await prisma.organization.findUnique({
    where: { id: session.user.organizationId }, select: { nequiTokenPendiente: true },
  })
  if (previo?.nequiTokenPendiente && !previo.nequiTokenPendiente.startsWith('guardando:')) {
    const anterior = await estadoTokenNequi(previo.nequiTokenPendiente).catch(() => null)
    if (anterior === 'APPROVED') {
      return NextResponse.json({ ok: true, tokenId: previo.nequiTokenPendiente, estado: anterior })
    }
  }
  try {
    const t = await pedirTokenNequi(telefono)
    /* ⚠ SE APUNTA (5 nov 2026): si el cliente aprueba con la pantalla cerrada,
       el servidor lo confirma solo (lib/pagos/confirmar-nequi.js). */
    await apuntarPedidoNequi(session.user.organizationId, { tokenId: t.id, plan: typeof plan === 'string' ? plan : null })
    console.log(`[wompi-nequi] autorización pedida para org ${session.user.organizationId} — token ${t.id} (${t.estado})`)
    return NextResponse.json({ ok: true, tokenId: t.id, estado: t.estado })
  } catch (e) {
    console.error('[wompi-nequi] no pude pedir la autorización:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

/* ── Paso 2: ¿ya aprobó? ──────────────────────────────────────────────────
 * La pantalla pregunta cada pocos segundos mientras está abierta. Lo que pasa
 * al aprobar vive en `confirmarNequi`, el MISMO que corre el cron cuando la
 * pantalla ya no está (lib/pagos/confirmar-nequi.js). */
export async function GET(req) {
  const { error, session } = await soloElDueno()
  if (error) return error

  const params = new URL(req.url).searchParams
  const tokenId = params.get('token')
  if (!tokenId) return NextResponse.json({ error: 'Falta el token' }, { status: 400 })

  try {
    const r = await confirmarNequi({
      organizationId: session.user.organizationId, tokenId,
      planElegido: params.get('plan'), origen: 'guardar-nequi',
    })
    if (r.error) return NextResponse.json({ error: r.error }, { status: 400 })
    return NextResponse.json({ ok: true, ...r })
  } catch (e) {
    console.error('[wompi-nequi] no pude confirmar la autorización:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
