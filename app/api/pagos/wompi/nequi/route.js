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
import { pedirTokenNequi, estadoTokenNequi, crearFuenteDePago, wompiConfigurado } from '@/lib/wompi'

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

  const { telefono } = await req.json().catch(() => ({}))
  try {
    const t = await pedirTokenNequi(telefono)
    console.log(`[wompi-nequi] autorización pedida para org ${session.user.organizationId} — token ${t.id} (${t.estado})`)
    return NextResponse.json({ ok: true, tokenId: t.id, estado: t.estado })
  } catch (e) {
    console.error('[wompi-nequi] no pude pedir la autorización:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

/* ── Paso 2: ¿ya aprobó? ──────────────────────────────────────────────────
 * La pantalla pregunta cada pocos segundos. Cuando Wompi dice APPROVED, se crea
 * la fuente de pago y se guarda.
 *
 * ⚠ SE GUARDA AQUÍ Y NO EN OTRO SITIO. Si la creación de la fuente viviera en
 * un tercer paso, una pantalla cerrada a destiempo dejaría un token aprobado
 * que no sirve para nada y a la persona convencida de que ya está suscrita. */
export async function GET(req) {
  const { error, session } = await soloElDueno()
  if (error) return error

  const tokenId = new URL(req.url).searchParams.get('token')
  if (!tokenId) return NextResponse.json({ error: 'Falta el token' }, { status: 400 })

  let estado
  try {
    estado = await estadoTokenNequi(tokenId)
  } catch (e) {
    console.error('[wompi-nequi] no pude consultar el token:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  if (estado !== 'APPROVED') {
    /* PENDING es lo normal mientras no toque «Aceptar». DECLINED y VOIDED son
       finales: dijo que no, o se le pasó el tiempo. */
    return NextResponse.json({ ok: true, estado, guardado: false })
  }

  const dueno = await prisma.user.findFirst({
    where: { organizationId: session.user.organizationId, rol: 'owner' },
    select: { email: true },
  })
  const email = dueno?.email ?? session.user.email
  if (!email) {
    return NextResponse.json({ error: 'La cuenta no tiene correo; Wompi lo exige' }, { status: 400 })
  }

  let fuente
  try {
    fuente = await crearFuenteDePago({ token: tokenId, tipo: 'NEQUI', email })
  } catch (e) {
    console.error('[wompi-nequi] Wompi rechazó la fuente:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const tel = String(fuente.publico?.phone_number ?? '')
  const rotulo = tel ? `Nequi ···${tel.slice(-4)}` : 'Nequi'

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      wompiFuentePagoId: fuente.id,
      wompiFuenteRotulo: rotulo,
      wompiFuenteTipo:   'NEQUI',
      wompiFuenteEmail:  email,
      cobroAutomatico:   true,
      /* Empieza de cero: si venía de tres cobros fallidos con el medio viejo,
         el nuevo no arrastra ese historial. */
      cobroFallos:       0,
    },
  })

  console.log(`[wompi-nequi] GUARDADO ${rotulo} para org ${session.user.organizationId} — fuente ${fuente.id}`)
  return NextResponse.json({ ok: true, estado, guardado: true, rotulo })
}
