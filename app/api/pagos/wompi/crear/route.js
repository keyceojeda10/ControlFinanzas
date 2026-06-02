// app/api/pagos/wompi/crear/route.js
// Inicia un pago de suscripcion con Wompi. Calcula el monto, genera una
// referencia unica y la firma de integridad, y devuelve al frontend los datos
// para abrir el Checkout Web de Wompi. El plan se activa luego via webhook.
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES, } from '@/lib/mercadopago'
import { getPrecioPlan } from '@/lib/planes'
import { hasOnlinePayment } from '@/lib/i18n'
import { firmaIntegridad, wompiPublicKey, wompiConfigurado, WOMPI_CHECKOUT_URL } from '@/lib/wompi'

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organización asociada' }, { status: 400 })

  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Pagos con Wompi no están configurados todavía. Contacta soporte.' }, { status: 503 })
  }

  const { plan, periodo = 'mensual' } = await req.json()
  const planInfo = PLANES[plan]
  if (!planInfo) return NextResponse.json({ error: 'Plan no válido' }, { status: 400 })
  if (!['mensual', 'trimestral', 'anual'].includes(periodo)) {
    return NextResponse.json({ error: 'Periodo no válido' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { descuento: true, country: true },
  })
  const country = org?.country ?? 'co'
  if (!hasOnlinePayment(country)) {
    return NextResponse.json({ error: 'Pago en linea no disponible para tu pais. Contacta soporte.' }, { status: 400 })
  }

  // Calculo de precio (mismo criterio que crear-preferencia de MercadoPago)
  const descuentoOrg     = org?.descuento ?? 0
  const esAnual          = periodo === 'anual'
  const esTrimestral     = periodo === 'trimestral'
  const descuentoPeriodo = esAnual ? 17 : esTrimestral ? 10 : 0
  const descuentoFinal   = esAnual ? 0 : Math.max(descuentoOrg, descuentoPeriodo)
  const meses            = esAnual ? 12 : esTrimestral ? 3 : 1
  const mesesCobrados    = esAnual ? 10 : meses
  const precioLocal      = getPrecioPlan(plan, country)
  const precioBase       = precioLocal * meses
  const precioFinal      = esAnual
    ? precioLocal * mesesCobrados
    : Math.round(precioBase * (1 - descuentoFinal / 100))

  if (!precioFinal || precioFinal <= 0) {
    return NextResponse.json({ error: 'Monto inválido' }, { status: 400 })
  }

  // Referencia unica. Formato: cf-<orgId>-<plan>-<periodo>-<timestamp>.
  // Codifica todo lo necesario para que el webhook resuelva la activacion.
  const ts = Date.now()
  const referencia = `cf-${orgId}-${plan}-${periodo}-${ts}`

  const montoCentavos = Math.round(precioFinal * 100)
  const moneda = 'COP'
  const firma = firmaIntegridad(referencia, montoCentavos, moneda)

  // Guardar una suscripcion 'pendiente' como rastro (se activa al confirmar el
  // webhook). Reusa el patron de crear-suscripcion. Guarda la referencia.
  await prisma.suscripcion.create({
    data: {
      organizationId:   orgId,
      plan,
      estado:           'pendiente',
      fechaInicio:      new Date(),
      fechaVencimiento: new Date(), // se ajusta al activar
      montoCOP:         precioFinal,
      gatewayPago:      'wompi',
      wompiReference:   referencia,
      mpStatus:         'pending', // reutiliza el filtro existente que ignora pendientes
    },
  }).catch(() => {}) // si falla el rastro, el pago igual puede confirmarse por referencia

  return NextResponse.json({
    publicKey:    wompiPublicKey(),
    referencia,
    montoCentavos,
    moneda,
    firma,
    checkoutUrl:  WOMPI_CHECKOUT_URL,
    redirectUrl:  `${BASE}/configuracion/plan?wompi=retorno`,
  })
}
