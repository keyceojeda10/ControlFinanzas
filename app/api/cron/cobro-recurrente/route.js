// app/api/cron/cobro-recurrente/route.js — el cobro que ocurre solo.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// Medido en producción el 1 sep 2026:
//
//   · de los que pagaron en junio, volvió en julio el 86 %
//   · de los que pagaron en julio, volvió en agosto el 64 %
//   · de los 59 negocios que han pagado alguna vez, 25 pagaron UNA sola vez
//   · de 653 suscripciones, 648 eran `pago_unico`; UNA sola era recurrente
//   · 83 de los 117 pagos entraron marcados como `manual`
//
// Cada mes había que volver a venderle a cada cliente. Un prestamista ocupado
// no vuelve a entrar a pagar: simplemente deja de pagar, y se entera de que se
// fue el día que la app deja de abrir.
//
// ══ LO QUE ESTE GUION NO HACE, A PROPÓSITO ═════════════════════════════════
//
// **No activa nada.** Dispara el cobro y se calla. Quien activa el plan es el
// webhook de Wompi, exactamente igual que en el pago manual. Un solo camino
// para activar es la única forma de que no se active dos veces ni ninguna: si
// activáramos aquí Y en el webhook, un cobro aprobado sumaría dos meses.
//
// **No corta a nadie.** Un cobro fallido no suspende: cuenta el fallo y lo
// vuelve a intentar. Cortarle el sistema a un prestamista por un rechazo de la
// pasarela —que puede ser un banco caído— es peor que esperar un día más.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cobrarConFuente, wompiConfigurado, referenciaDeCobro } from '@/lib/wompi'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET

/* ⚠ EL INTERRUPTOR. Sin `COBRO_RECURRENTE_ACTIVO=1` esto no cobra nada y lo
   dice. Se puede programar desde ya y encenderlo cuando esté probado con una
   tarjeta de verdad: un cron que cobra no se estrena a ciegas. */
const ENCENDIDO = process.env.COBRO_RECURRENTE_ACTIVO === '1'

/* Tres intentos y se para. Al cuarto día el cliente ya sabe que algo pasa —le
   avisan el correo, el push y WhatsApp— y seguir intentando contra una tarjeta
   sin fondos solo suma rechazos, que ensucian la reputación del comercio. */
const MAX_FALLOS = 3

/* Un intento al día como mucho. Sin esto, dos ejecuciones del cron en el mismo
   día cobrarían dos veces. */
const HORAS_ENTRE_INTENTOS = 20

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  if (!ENCENDIDO) {
    return NextResponse.json({ ok: true, apagado: true, motivo: 'falta COBRO_RECURRENTE_ACTIVO=1' })
  }
  if (!wompiConfigurado()) {
    return NextResponse.json({ error: 'Wompi no configurado' }, { status: 500 })
  }

  const ahora = new Date()
  const desdeIntento = new Date(ahora.getTime() - HORAS_ENTRE_INTENTOS * 3600000)
  const res = { candidatos: 0, cobrados: 0, rechazados: 0, errores: 0, saltados: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        cobroAutomatico: true,
        wompiFuentePagoId: { not: null },
        cobroFallos: { lt: MAX_FALLOS },
        /* Un intento al día: `null` (nunca intentado) también entra. */
        OR: [
          { cobroUltimoIntento: null },
          { cobroUltimoIntento: { lt: desdeIntento } },
        ],
        /* ⚠ SOLO SI YA VENCIÓ O VENCE HOY. Cobrar antes de tiempo es cobrarle
           al cliente un mes que todavía no ha usado, y es la clase de error que
           no se perdona. */
        suscripciones: {
          some: {
            estado: 'activa',
            montoCOP: { gt: 0 },
            fechaVencimiento: { lte: ahora },
          },
        },
      },
      select: {
        id: true, nombre: true, wompiFuentePagoId: true, wompiFuenteEmail: true,
        cobroFallos: true,
        suscripciones: {
          where: { estado: 'activa', montoCOP: { gt: 0 } },
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          select: { plan: true, montoCOP: true, fechaVencimiento: true },
        },
      },
    })

    for (const org of orgs) {
      const sub = org.suscripciones?.[0]
      if (!sub || !org.wompiFuenteEmail) { res.saltados++; continue }
      res.candidatos++

      /* La referencia lleva el MISMO formato que el pago manual, porque quien
         la lee es el mismo webhook: `cf-{org}-{plan}-{periodo}-{ts}`. Cambiarla
         aquí dejaría el cobro aprobado sin poder activarse. */
      const referencia = referenciaDeCobro(org.id, sub.plan, 'mensual')

      /* El intento se apunta ANTES de llamar a Wompi. Si el proceso se cae a
         mitad, el peor caso es que hoy no se reintente; al revés —apuntarlo
         después— el peor caso es cobrar dos veces. */
      await prisma.organization.update({
        where: { id: org.id },
        data: { cobroUltimoIntento: ahora },
      })

      let r
      try {
        r = await cobrarConFuente({
          fuenteId:   org.wompiFuentePagoId,
          montoCOP:   sub.montoCOP,
          email:      org.wompiFuenteEmail,
          referencia,
        })
      } catch (e) {
        res.errores++
        console.error(`[cobro-recurrente] error llamando a Wompi para "${org.nombre}": ${e.message}`)
        continue
      }

      if (!r.ok) {
        const fallos = org.cobroFallos + 1
        await prisma.organization.update({
          where: { id: org.id },
          data: { cobroFallos: fallos },
        })
        res.rechazados++
        console.warn(`[cobro-recurrente] RECHAZADO "${org.nombre}" (${fallos}/${MAX_FALLOS}): ${r.motivo}`)
        continue
      }

      /* Aceptado NO es cobrado: nace `PENDING` y puede acabar en DECLINED. Por
         eso el contador de fallos NO se pone a cero aquí — lo pone a cero el
         webhook cuando el pago queda APROBADO de verdad. */
      res.cobrados++
      console.log(`[cobro-recurrente] enviado ${sub.plan} $${sub.montoCOP} de "${org.nombre}" — tx ${r.id} (${r.estado}) ref ${referencia}`)
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON cobro-recurrente]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
