import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES_CONFIG } from '@/lib/planes'
import { precioCheckout, inicioDelPeriodo, selectPrecio } from '@/lib/precio-plan'
import { ultimaSuscripcion, adicionalesDe } from '@/lib/cobro-intento'
import { hasOnlinePayment } from '@/lib/i18n'
import { firmaIntegridad, wompiPublicKey, wompiConfigurado, WOMPI_CHECKOUT_URL, referenciaDeCobro } from '@/lib/wompi'

const BASE = process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const orgId = session.user.organizationId
  if (!orgId) return NextResponse.json({ error: 'Sin organizacion asociada' }, { status: 400 })

  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Pagos con Wompi no estan configurados. Contacta soporte.' }, { status: 503 })
  }

  const { plan, periodo = 'mensual' } = await req.json()
  if (!PLANES_CONFIG[plan]) return NextResponse.json({ error: 'Plan no valido' }, { status: 400 })
  if (!['mensual', 'trimestral', 'anual'].includes(periodo)) {
    return NextResponse.json({ error: 'Periodo no valido' }, { status: 400 })
  }

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: selectPrecio,
  })
  const country = org?.country ?? 'co'
  if (!hasOnlinePayment(country)) {
    return NextResponse.json({ error: 'Pago en linea no disponible para tu pais.' }, { status: 400 })
  }

  /* ⚠ EL PRECIO LO DICE lib/precio-plan.js, igual que al cobro automático.
     Aquí vivía `lista × (1 − descuento %)`, un campo que no usaba nadie,
     mientras el panel ponía precios a mano que ninguna pantalla conocía. El
     periodo empieza donde lo extendería el pago: si el preferencial termina a
     mitad de un trimestre, cada mes paga lo suyo. */
  const ultima           = await ultimaSuscripcion(orgId)
  /* Con los cobradores y rutas adicionales del negocio: van con el plan en
     cada pago (ver `precioCheckout`). */
  const precioFinal      = precioCheckout(org, plan, periodo, inicioDelPeriodo(ultima)).total

  if (!precioFinal || precioFinal <= 0) {
    return NextResponse.json({ error: 'Monto invalido' }, { status: 400 })
  }

  /* ⚠ La referencia la escribe `referenciaDeCobro` y la lee `leerReferencia`,
     las dos en `lib/wompi.js`. Escrita a mano aquí, cualquier cambio de formato
     dejaba pagos APROBADOS que el webhook no sabía a quién activarle. */
  /* Con los adicionales que este pago cobra: al aprobarse quedan en eso y no
     más, aunque se hayan subido después de abrir el checkout. */
  const referencia = referenciaDeCobro(orgId, plan, periodo, adicionalesDe(org, plan))
  const montoCentavos = Math.round(precioFinal * 100)
  const moneda = 'COP'
  const firma = firmaIntegridad(referencia, montoCentavos, moneda)

  await prisma.suscripcion.create({
    data: {
      organizationId:   orgId,
      plan,
      estado:           'pendiente',
      fechaInicio:      new Date(),
      fechaVencimiento: new Date(),
      montoCOP:         precioFinal,
      gatewayPago:      'wompi',
      wompiReference:   referencia,
      mpStatus:         'pending',
    },
  }).catch(() => {})

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
