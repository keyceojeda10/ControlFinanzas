// app/api/pagos/wompi/fuente/route.js — guardar (o quitar) el medio de pago
// con el que se cobrará solo cada mes.
//
// ══ POR QUÉ ════════════════════════════════════════════════════════════════
//
// Medido el 1 sep 2026: de los que pagaron en julio volvió a pagar en agosto el
// 64 %, y 25 de los 59 negocios que han pagado alguna vez pagaron UNA sola vez.
// De 653 suscripciones, 648 eran `pago_unico`. Cada mes había que volver a
// venderle a cada cliente, y un prestamista ocupado no vuelve a entrar a pagar:
// simplemente deja de pagar.
//
// Aquí el cliente da UNA vez el permiso —con su autenticación, en el widget de
// Wompi— y a partir de ahí el cobro ocurre solo.
//
// ⚠ POR AQUÍ NO PASAN DATOS DE TARJETA, Y NO DEBEN PASAR NUNCA. El widget de
// Wompi los tokeniza dentro de su propio iframe; lo que llega aquí es un token
// de un solo uso. Si algún día alguien manda un número de tarjeta a este
// endpoint, el fallo no es de código: es de diseño, y nos mete en una
// obligación legal que hoy no tenemos.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { crearFuenteDePago, wompiConfigurado, wompiPublicKey } from '@/lib/wompi'

/** «VISA ····4242» / «Nequi ···3001»: lo justo para que reconozca cuál es. */
function rotuloDe(tipo, publico = {}) {
  if (tipo === 'NEQUI') {
    const tel = String(publico.phone_number ?? '')
    return tel ? `Nequi ···${tel.slice(-4)}` : 'Nequi'
  }
  const marca = String(publico.brand ?? publico.type ?? 'Tarjeta').toUpperCase()
  const cuatro = publico.last_four ?? publico.last4
  return cuatro ? `${marca} ····${cuatro}` : marca
}

/** Lo que la pantalla necesita para pintar: qué medio hay guardado y la llave
 *  pública con la que se abre el widget. */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const org = await prisma.organization.findUnique({
    where: { id: session.user.organizationId },
    select: {
      wompiFuenteRotulo: true, wompiFuenteTipo: true,
      cobroAutomatico: true, cobroFallos: true,
    },
  })
  return NextResponse.json({
    configurado: wompiConfigurado(),
    publicKey:   wompiPublicKey(),
    /* `esDueno` decide si se pinta el botón: un cobrador no compromete la plata
       del negocio, y esconderlo es más claro que dejarle pulsar y fallar. */
    esDueno:     session.user.rol === 'owner',
    fuente: org?.wompiFuenteRotulo
      ? { rotulo: org.wompiFuenteRotulo, tipo: org.wompiFuenteTipo,
          activo: org.cobroAutomatico, fallos: org.cobroFallos }
      : null,
  })
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  /* Guardar un medio de pago compromete plata del negocio: solo el dueño. */
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño puede guardar el medio de pago' }, { status: 403 })
  }
  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Pagos con Wompi no están configurados' }, { status: 503 })
  }

  const { token, tipo } = await req.json().catch(() => ({}))
  if (!token || typeof token !== 'string') {
    return NextResponse.json({ error: 'Falta el token del medio de pago' }, { status: 400 })
  }
  if (!['CARD', 'NEQUI'].includes(tipo)) {
    return NextResponse.json({ error: 'Tipo de medio de pago no soportado' }, { status: 400 })
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
    fuente = await crearFuenteDePago({ token, tipo, email })
  } catch (e) {
    /* El motivo de Wompi llega entero a la pantalla: «tarjeta declinada» y
       «token ya usado» piden cosas distintas del cliente. */
    console.error('[wompi-fuente] no se pudo guardar:', e.message)
    return NextResponse.json({ error: e.message }, { status: 400 })
  }

  const rotulo = rotuloDe(tipo, fuente.publico)
  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      wompiFuentePagoId: fuente.id,
      wompiFuenteRotulo: rotulo,
      wompiFuenteTipo:   tipo,
      wompiFuenteEmail:  email,
      cobroAutomatico:   true,
      /* Empieza de cero: si venía de tres cobros fallidos con el medio viejo,
         el nuevo no arrastra ese historial. */
      cobroFallos:       0,
    },
  })

  console.log(`[wompi-fuente] guardada ${tipo} (${rotulo}) para org ${session.user.organizationId} — fuente ${fuente.id}`)
  return NextResponse.json({ ok: true, rotulo, tipo, estado: fuente.estado })
}

/* Quitar el medio de pago tiene que ser tan fácil como ponerlo. No es cortesía:
   es lo que separa un cobro autorizado de uno que el cliente no puede parar. */
export async function DELETE() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return NextResponse.json({ error: 'Solo el dueño puede quitar el medio de pago' }, { status: 403 })
  }

  await prisma.organization.update({
    where: { id: session.user.organizationId },
    data: {
      wompiFuentePagoId: null,
      wompiFuenteRotulo: null,
      wompiFuenteTipo:   null,
      wompiFuenteEmail:  null,
      cobroAutomatico:   false,
      cobroFallos:       0,
    },
  })
  console.log(`[wompi-fuente] quitada para org ${session.user.organizationId}`)
  return NextResponse.json({ ok: true })
}
