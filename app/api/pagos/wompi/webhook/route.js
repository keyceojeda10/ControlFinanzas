// app/api/pagos/wompi/webhook/route.js — Webhook de Wompi
// Recibe eventos 'transaction.updated'. Si la transaccion fue APPROVED, valida
// la firma del evento, confirma el estado real con la API de Wompi, resuelve la
// referencia (cf-<orgId>-<plan>-<periodo>-<ts>) y activa el plan.
import { NextResponse } from 'next/server'
import { validarFirmaEvento, consultarTransaccion } from '@/lib/wompi'
import { activarPlanPagado } from '@/lib/activar-suscripcion'
import { webhookLimiter, getClientIp } from '@/lib/rate-limit'

// Parsea la referencia cf-<orgId>-<plan>-<periodo>-<ts>.
// El orgId es un cuid (sin guiones internos problematicos), pero plan/periodo
// son tokens conocidos al final, asi que parseamos desde el final para evitar
// ambiguedad si el orgId tuviera guiones.
function parseReferencia(ref) {
  if (!ref || !ref.startsWith('cf-')) return null
  const partes = ref.split('-')
  if (partes.length < 5) return null
  // [cf, ...orgId..., plan, periodo, ts]
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

  // Validar firma del evento (con WOMPI_EVENTS_KEY).
  if (!validarFirmaEvento(body)) {
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  // Solo nos interesa la actualizacion de transacciones.
  if (body?.event !== 'transaction.updated') {
    return NextResponse.json({ ok: true })
  }

  const txEvento = body?.data?.transaction
  if (!txEvento?.id) {
    return NextResponse.json({ ok: true })
  }

  // Confirmar el estado REAL consultando a Wompi (no confiar solo en el body).
  let tx = null
  try {
    tx = await consultarTransaccion(txEvento.id)
  } catch (e) {
    console.error('[wompi-webhook] error consultando transaccion:', e.message)
    return NextResponse.json({ error: 'Error consultando transacción' }, { status: 500 })
  }
  // Si la API no responde, caer al dato del evento (ya validado por firma).
  const estado = (tx?.status || txEvento.status)
  const referencia = (tx?.reference || txEvento.reference)
  const montoCentavos = (tx?.amount_in_cents ?? txEvento.amount_in_cents ?? 0)

  if (estado !== 'APPROVED') {
    // DECLINED / VOIDED / ERROR / PENDING: no activar. (Pendiente: Wompi reintenta.)
    return NextResponse.json({ ok: true })
  }

  const parsed = parseReferencia(referencia)
  if (!parsed) {
    console.warn('[wompi-webhook] referencia no reconocida:', referencia)
    return NextResponse.json({ ok: true })
  }

  try {
    const r = await activarPlanPagado({
      organizationId: parsed.orgId,
      plan:           parsed.plan,
      periodo:        parsed.periodo,
      montoCOP:       Math.round(montoCentavos / 100),
      gateway:        'wompi',
      gatewayId:      txEvento.id,
      referencia,
    })
    if (r.yaProcesado) console.log('[wompi-webhook] tx ' + txEvento.id + ' ya procesada, ignorando')
  } catch (err) {
    console.error('[wompi-webhook] error activando plan:', err)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
