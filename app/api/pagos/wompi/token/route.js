// app/api/pagos/wompi/token/route.js — donde aterriza el widget de Wompi
// después de que el cliente guarda su medio de pago.
//
// ══ POR QUÉ ES UN FORMULARIO Y NO UN `fetch` ═══════════════════════════════
//
// El widget en modo tokenización se declara como un `<form>` con un `<script>`
// dentro, y al terminar hace un POST de formulario a su `action`. No hay
// callback de JavaScript como en el modo de cobro, así que la vuelta pasa por
// aquí y desde aquí se redirige a la pantalla del plan.
//
// ⚠ EL MODO TOKENIZACIÓN NO ESTÁ EN LA DOCUMENTACIÓN DE COLOMBIA (sí en la de
// Panamá). Comprobado a mano el 1 sep 2026 cargando el widget con
// `data-widget-operation="tokenize"` contra `checkout.wompi.co/widget.js` con
// la llave pública de producción: pinta el botón «Guarda tu método de pago».
// Funciona, pero no está escrito en ningún sitio — si un día deja de ir, esto
// es lo primero que hay que volver a probar.
//
// ⚠ Y POR ESO ESTE RECEPTOR ES TOLERANTE. No sabemos con qué nombre exacto
// llega el token, porque eso solo lo dice una tokenización de verdad y hacen
// falta datos de una tarjeta real. Se buscan los nombres plausibles y, si no
// aparece ninguno, se registran LAS CLAVES que sí llegaron —nunca sus valores—
// para que el primer uso real deje escrito el nombre bueno en el log en vez de
// un «algo salió mal» sin pistas.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { crearFuenteDePago, cobrarConFuente, wompiConfigurado, referenciaDeCobro } from '@/lib/wompi'
import { PLANES_CONFIG, getPrecioPlan } from '@/lib/planes'

const DESTINO = '/configuracion/plan'

/* El mismo candado que el cron: un intento de cobro cada 20 horas como mucho.
   Aquí protege del doble clic y del cliente que guarda su medio dos veces. */
const HORAS_ENTRE_INTENTOS = 20

/* ⚠ POR QUÉ GUARDAR EL MEDIO A VECES COBRA, Y A VECES NO.
 *
 * Guardar la tarjeta no debería cobrar nada: el cobro sale cuando venza el
 * plan. Pero hay un agujero: el cron solo mira a quien YA tiene una suscripción
 * de pago activa. Quien está en prueba, o en el plan gratis, no tiene ninguna
 * — así que se «suscribiría», no se le cobraría nunca, y el día que venza la
 * prueba se quedaría fuera creyendo que estaba al día.
 *
 * Por eso: si NO hay un plan de pago vigente, este primer cobro se hace ahora,
 * que es exactamente lo que espera quien acaba de pulsar «Suscribirme». Si sí
 * lo hay, no se toca nada y el cron toma el relevo al vencer.
 *
 * Como todo lo demás, esto NO activa el plan: lo activa el webhook cuando el
 * pago quede APROBADO. Un solo camino para activar. */
async function primerCobroSiHaceFalta({ orgId, plan, fuenteId, email }) {
  if (!plan || !PLANES_CONFIG[plan]) return null

  const ahora = new Date()
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      descuento: true, country: true, cobroUltimoIntento: true,
      suscripciones: {
        where: { estado: 'activa', montoCOP: { gt: 0 }, fechaVencimiento: { gt: ahora } },
        take: 1, select: { id: true },
      },
    },
  })
  if (!org) return null
  /* Ya tiene plan de pago vigente: pagó, y el cron lo renovará al vencer. */
  if (org.suscripciones.length > 0) return null

  const desde = new Date(ahora.getTime() - HORAS_ENTRE_INTENTOS * 3600000)
  if (org.cobroUltimoIntento && org.cobroUltimoIntento > desde) {
    console.warn(`[wompi-token] no cobro: ya hubo un intento hace menos de ${HORAS_ENTRE_INTENTOS} h (org ${orgId})`)
    return null
  }

  const precio = getPrecioPlan(plan, org.country ?? 'co')
  const monto = Math.round(precio * (1 - (org.descuento ?? 0) / 100))
  if (!monto || monto <= 0) return null

  /* Se apunta ANTES de llamar a Wompi: si esto se cae a mitad, el peor caso es
     no reintentar hoy, que es mucho más barato que cobrar dos veces. */
  await prisma.organization.update({ where: { id: orgId }, data: { cobroUltimoIntento: ahora } })

  const referencia = referenciaDeCobro(orgId, plan, 'mensual')
  const r = await cobrarConFuente({ fuenteId, montoCOP: monto, email, referencia })
  console.log(`[wompi-token] primer cobro ${plan} $${monto} org ${orgId} — ${r.ok ? `tx ${r.id} (${r.estado})` : `RECHAZADO: ${r.motivo}`} ref ${referencia}`)
  return r
}

/* Los nombres con los que Wompi podría mandar el token. El primero que venga
   con pinta de token (`tok_…`) gana. */
const POSIBLES = ['id', 'token', 'tokenId', 'token_id', 'paymentToken', 'payment_token', 'data[id]']

function sacarToken(campos) {
  for (const k of POSIBLES) {
    const v = campos[k]
    if (typeof v === 'string' && v.startsWith('tok_')) return v
  }
  /* Y por si el nombre es otro: cualquier valor con forma de token sirve. Es
     preferible aceptar el bueno con un nombre inesperado que rechazar un medio
     de pago que el cliente acaba de autorizar. */
  for (const v of Object.values(campos)) {
    if (typeof v === 'string' && v.startsWith('tok_')) return v
  }
  return null
}

function volver(estado, detalle) {
  const qs = new URLSearchParams({ medio: estado, ...(detalle ? { detalle } : {}) })
  return NextResponse.redirect(new URL(`${DESTINO}?${qs}`, process.env.NEXTAUTH_URL || 'https://app.control-finanzas.com'), 303)
}

export async function POST(req) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId || session.user.rol !== 'owner') {
    return volver('no-autorizado')
  }
  if (!wompiConfigurado()) return volver('error', 'Wompi no está configurado')

  let campos = {}
  try {
    const form = await req.formData()
    campos = Object.fromEntries(form.entries())
  } catch {
    try { campos = await req.json() } catch { campos = {} }
  }

  const token = sacarToken(campos)
  if (!token) {
    /* SOLO LAS CLAVES. El contenido puede traer datos del medio de pago y esto
       va a un log que lee cualquiera con acceso al servidor. */
    console.error('[wompi-token] no encontré el token. Claves recibidas:', Object.keys(campos).join(', ') || '(ninguna)')
    return volver('error', 'No llegó el token del medio de pago')
  }

  /* El widget no dice si fue tarjeta o Nequi. Los tokens de Nequi de Wompi
     llevan `nequi` en el prefijo; el resto se tratan como tarjeta. */
  const tipo = /nequi/i.test(token) ? 'NEQUI' : 'CARD'

  const dueno = await prisma.user.findFirst({
    where: { organizationId: session.user.organizationId, rol: 'owner' },
    select: { email: true },
  })
  const email = dueno?.email ?? session.user.email
  if (!email) return volver('error', 'La cuenta no tiene correo')

  try {
    const fuente = await crearFuenteDePago({ token, tipo, email })
    const publico = fuente.publico ?? {}
    const rotulo = tipo === 'NEQUI'
      ? `Nequi ···${String(publico.phone_number ?? '').slice(-4)}`
      : `${String(publico.brand ?? 'Tarjeta').toUpperCase()} ····${publico.last_four ?? ''}`.trim()

    await prisma.organization.update({
      where: { id: session.user.organizationId },
      data: {
        wompiFuentePagoId: fuente.id,
        wompiFuenteRotulo: rotulo,
        wompiFuenteTipo:   tipo,
        wompiFuenteEmail:  email,
        cobroAutomatico:   true,
        cobroFallos:       0,
      },
    })
    console.log(`[wompi-token] guardado ${tipo} (${rotulo}) para org ${session.user.organizationId} — fuente ${fuente.id}`)

    /* Si el primer cobro falla, el medio YA está guardado: no se deshace nada,
       se le dice y punto. Deshacerlo dejaría al cliente sin suscripción por un
       banco caído. */
    let cobro = null
    try {
      cobro = await primerCobroSiHaceFalta({
        orgId:    session.user.organizationId,
        plan:     typeof campos.plan === 'string' ? campos.plan : null,
        fuenteId: fuente.id,
        email,
      })
    } catch (e) {
      console.error('[wompi-token] fallo el primer cobro:', e.message)
      return volver('guardado-sin-cobro', e.message.slice(0, 120))
    }
    if (cobro && !cobro.ok) return volver('guardado-sin-cobro', cobro.motivo?.slice(0, 120))
    if (cobro) return volver('cobrando')
    return volver('guardado')
  } catch (e) {
    console.error('[wompi-token] Wompi rechazó la fuente:', e.message)
    return volver('error', e.message.slice(0, 120))
  }
}
