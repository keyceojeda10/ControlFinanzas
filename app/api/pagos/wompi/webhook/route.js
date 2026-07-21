// Webhook de eventos de Wompi.
//
// Este endpoint era MUDO: firma invalida, evento ignorado, transaccion no
// aprobada y hasta la activacion exitosa salian todas sin dejar rastro. Con 16
// suscripciones ya procesadas no habia UN SOLO log de Wompi en el servidor, asi
// que era imposible saber si funcionaba. Ahora cada camino se registra con el
// prefijo [wompi-webhook], y si entra plata que no se puede activar, avisa.
import { NextResponse } from 'next/server'
import { validarFirmaEvento, consultarTransaccion } from '@/lib/wompi'
import { activarPlanPagado } from '@/lib/activar-suscripcion'
import { webhookLimiter, getClientIp } from '@/lib/rate-limit'
import { alertarPagoSinActivar, alertarPagoRevertido } from '@/lib/alertas-pago'
import { prisma } from '@/lib/prisma'

// Estados a los que puede caer una transaccion que YA estaba aprobada: una
// anulacion, un contracargo o una devolucion.
const ESTADOS_REVERSION = new Set(['VOIDED', 'DECLINED', 'ERROR'])

function parseReferencia(ref) {
  if (!ref || !ref.startsWith('cf-')) return null
  const partes = ref.split('-')
  if (partes.length < 5) return null
  const ts = partes[partes.length - 1]
  const periodo = partes[partes.length - 2]
  const plan = partes[partes.length - 3]
  const orgId = partes.slice(1, partes.length - 3).join('-')
  if (!orgId || !plan || !periodo) return null
  return { orgId, plan, periodo, ts }
}

export async function POST(req) {
  const rl = webhookLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfter) } })

  let body
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (!validarFirmaEvento(body)) {
    // Camino critico y antes invisible: si la WOMPI_EVENTS_KEY se desconfigura,
    // TODOS los pagos dejan de activarse y desde el sistema no se nota nada.
    console.error('[wompi-webhook] FIRMA INVALIDA — evento rechazado. Revisar WOMPI_EVENTS_KEY. tx:', body?.data?.transaction?.id ?? '(sin id)')
    return NextResponse.json({ error: 'Firma invalida' }, { status: 401 })
  }

  // Una linea por evento recibido y con firma valida. Es la que responde, de un
  // vistazo en los logs, la pregunta que antes no se podia contestar: "¿Wompi
  // nos esta llamando?". Son pocos eventos al dia, no genera ruido.
  console.log(`[wompi-webhook] evento recibido: ${body?.event} | tx: ${body?.data?.transaction?.id ?? '-'}`)

  if (body?.event !== 'transaction.updated') {
    console.log(`[wompi-webhook] evento ${body?.event} ignorado (solo se procesa transaction.updated)`)
    return NextResponse.json({ ok: true })
  }

  const txEvento = body?.data?.transaction
  if (!txEvento?.id) {
    console.warn('[wompi-webhook] evento transaction.updated sin id de transaccion')
    return NextResponse.json({ ok: true })
  }

  let tx = null
  try {
    tx = await consultarTransaccion(txEvento.id)
  } catch (e) {
    console.error('[wompi-webhook] error consultando transaccion:', e.message)
    return NextResponse.json({ error: 'Error consultando transaccion' }, { status: 500 })
  }

  const estado = (tx?.status || txEvento.status)
  const referencia = (tx?.reference || txEvento.reference)
  const montoCentavos = (tx?.amount_in_cents ?? txEvento.amount_in_cents ?? 0)
  const montoCOP = Math.round(montoCentavos / 100)

  if (estado !== 'APPROVED') {
    // No es un error: DECLINED o VOIDED simplemente no activan nada y el
    // cliente queda como estaba. Se registra para poder distinguir "llego y se
    // rechazo" de "nunca llego", que era imposible de saber.
    console.log(`[wompi-webhook] tx ${txEvento.id} en estado ${estado} — no activa nada (ref: ${referencia})`)

    // Caso distinto y mas delicado: que esta MISMA transaccion ya hubiera
    // activado un plan y ahora venga anulada. Ahi el cliente quedo con servicio
    // y el dinero se devolvio. No se suspende automaticamente —cortarle el
    // sistema a alguien por un evento de la pasarela es peor que esperar— pero
    // hay que enterarse en el momento.
    if (ESTADOS_REVERSION.has(estado)) {
      try {
        const sub = await prisma.suscripcion.findUnique({
          where: { wompiTransactionId: String(txEvento.id) },
          select: {
            plan: true,
            fechaVencimiento: true,
            montoCOP: true,
            organization: { select: { nombre: true } },
          },
        })
        if (sub) {
          console.error(`[wompi-webhook] PAGO REVERTIDO: tx ${txEvento.id} paso a ${estado} pero YA habia activado el plan ${sub.plan} de "${sub.organization?.nombre}" (vence ${sub.fechaVencimiento?.toISOString?.()})`)
          await alertarPagoRevertido({
            gateway: 'wompi',
            transaccionId: txEvento.id,
            estadoNuevo: estado,
            organizacion: sub.organization?.nombre,
            plan: sub.plan,
            fechaVencimiento: sub.fechaVencimiento,
            montoCOP: sub.montoCOP,
          })
        }
      } catch (e) {
        console.error('[wompi-webhook] error verificando si la tx revertida ya estaba aplicada:', e.message)
      }
    }

    return NextResponse.json({ ok: true })
  }

  const parsed = parseReferencia(referencia)
  if (!parsed) {
    // Pago APROBADO cuya referencia no sabemos a que organizacion pertenece:
    // entro plata y no hay a quien activarsela. Requiere humano.
    console.error('[wompi-webhook] PAGO APROBADO con referencia no reconocida:', referencia, '| tx:', txEvento.id)
    await alertarPagoSinActivar({
      gateway: 'wompi',
      transaccionId: txEvento.id,
      referencia,
      montoCOP,
      motivo: 'La referencia no tiene el formato esperado, no se puede saber a que organizacion activarle el plan.',
    })
    return NextResponse.json({ ok: true })
  }

  try {
    const r = await activarPlanPagado({
      organizationId: parsed.orgId,
      plan:           parsed.plan,
      periodo:        parsed.periodo,
      montoCOP,
      gateway:        'wompi',
      gatewayId:      txEvento.id,
      referencia,
    })
    if (r.yaProcesado) {
      console.log(`[wompi-webhook] tx ${txEvento.id} ya procesada, ignorando (org ${parsed.orgId})`)
    } else {
      // El camino feliz tambien se registra: sin esto era imposible confirmar
      // que la integracion estaba viva.
      console.log(`[wompi-webhook] ACTIVADO plan ${parsed.plan} (${parsed.periodo}) para org ${parsed.orgId} por $${montoCOP} — tx ${txEvento.id}`)
    }
  } catch (err) {
    // Plata cobrada y activacion fallida: es el caso mas caro y hay que
    // enterarse en el momento, no cuando el cliente reclame.
    console.error('[wompi-webhook] PAGO APROBADO pero fallo la activacion:', err?.message || err, '| tx:', txEvento.id, '| org:', parsed.orgId)
    await alertarPagoSinActivar({
      gateway: 'wompi',
      transaccionId: txEvento.id,
      referencia,
      montoCOP,
      motivo: `Fallo al activar el plan ${parsed.plan} de la organizacion ${parsed.orgId}: ${err?.message || 'error desconocido'}`,
    })
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
