// app/api/pagos/crear-suscripcion/route.js — Crear suscripción recurrente (MercadoPago PreApproval)
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { preApprovalApi, PLANES, buildPreapprovalBody } from '@/lib/mercadopago'
import { PLANES_VALIDOS } from '@/lib/planes'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })

  const { plan, periodo = 'mensual' } = await req.json()

  if (!PLANES_VALIDOS.includes(plan)) {
    return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
  }
  if (!PLANES[plan]) {
    return NextResponse.json({ error: 'Plan no encontrado' }, { status: 400 })
  }

  // Verificar si hay suscripción recurrente activa ya autorizada
  const autorizada = await prisma.suscripcion.findFirst({
    where: {
      organizationId: orgId,
      tipo: 'recurrente',
      estado: 'activa',
      mpStatus: 'authorized',
    },
  })

  if (autorizada) {
    return NextResponse.json(
      { error: 'Ya tienes una suscripción activa. Cancélala primero para cambiar de plan.' },
      { status: 409 }
    )
  }

  // Limpiar suscripciones pendientes abandonadas (nunca autorizadas)
  await prisma.suscripcion.deleteMany({
    where: {
      organizationId: orgId,
      tipo: 'recurrente',
      mpStatus: 'pending',
    },
  })

  // Construir body del preapproval
  const body = buildPreapprovalBody({
    plan,
    periodo,
    orgId,
    payerEmail: session.user.email,
  })

  if (!body) {
    return NextResponse.json({ error: 'Error al construir suscripción' }, { status: 500 })
  }

  let preapproval
  try {
    preapproval = await preApprovalApi.create({ body })
  } catch (err) {
    console.error('[crear-suscripcion] Error creando preapproval en MP:', err?.message || err, err?.cause || '')
    return NextResponse.json({ error: 'Error al crear la suscripción en MercadoPago' }, { status: 500 })
  }

  const frecuencia = periodo === 'anual' ? 12 : periodo === 'trimestral' ? 3 : 1

  try {
    // Crear registro de suscripción pendiente (NO activa hasta que MP confirme el pago)
    await prisma.suscripcion.create({
      data: {
        organizationId:   orgId,
        plan:             plan,
        tipo:             'recurrente',
        estado:           'pendiente',
        fechaInicio:      new Date(),
        fechaVencimiento: new Date(), // Se actualiza con el primer cobro
        montoCOP:         body.auto_recurring.transaction_amount,
        preapprovalId:    String(preapproval.id),
        mpStatus:         'pending',
        frecuenciaMeses:  frecuencia,
      },
    })
  } catch (err) {
    // Rollback: cancelar el preapproval en MP para no dejar huerfano
    console.error('[crear-suscripcion] Error al persistir suscripcion, cancelando preapproval MP', String(preapproval.id), ':', err?.message || err)
    try {
      await preApprovalApi.update({ id: String(preapproval.id), body: { status: 'cancelled' } })
      console.log('[crear-suscripcion] preapproval cancelado en MP:', preapproval.id)
    } catch (cancelErr) {
      console.error('[crear-suscripcion] No se pudo cancelar preapproval huerfano:', String(preapproval.id), cancelErr?.message || cancelErr)
    }
    return NextResponse.json({ error: 'No se pudo guardar la suscripción. Intenta de nuevo.' }, { status: 500 })
  }

  return NextResponse.json({ initPoint: preapproval.init_point })
}
