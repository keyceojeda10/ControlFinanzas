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
// webhook de Wompi (o `reconciliar`, si el webhook no llegó), siempre por
// `activarPlanPagado`, que no activa dos veces el mismo pago.
//
// ══ Y LO QUE SÍ HACE DESDE EL 12 SEP 2026 ══════════════════════════════════
//
// **Cobra ANTES de que venza** (`HORAS_DE_ANTICIPO`). Una pasada al día: con
// 48 h el primer intento sale entre 24 y 48 h antes, y si no había saldo queda
// otro antes de la hora de corte. El dueño: «si el plan le vence a las siete y
// el cron pasa a las ocho, va a tener una hora sin acceso y no sería correcto».
//
// **Un rechazo cierra.** Quien tenía el cobro puesto y la pasarela dijo que no
// se queda sin acceso a la hora exacta del vencimiento, como quien paga a mano.
//
// ══ Y DESDE EL 13 NOV 2026: LOS REINTENTOS, DE NOCHE Y HASTA 15 DÍAS ═══════
//
// Dos pasadas (`quePasaEnLaPasada`, lib/cobro-automatico.js):
//   · sin parámetro, a las 08:00 de Colombia (13:00 UTC): el cobro normal, como
//     siempre. Un periodo que ya tiene rechazo no lo toca.
//   · `?pasada=noche`, a las 22:00 (03:00 UTC): solo los reintentos, la misma
//     noche del rechazo y luego las del calendario, hasta 15 días. De noche
//     hay plata en el Nequi, y no es una hora «visual»: no se avisa a nadie.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { wompiConfigurado } from '@/lib/wompi'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'
import { MAX_FALLOS, HORAS_DE_ANTICIPO, HORAS_DE_REINTENTO, rechazoVigente, quePasaEnLaPasada } from '@/lib/cobro-automatico'
import { lanzarCobro, reconciliar } from '@/lib/cobro-intento'
import { montoDelCobro, selectPrecio, selectPago } from '@/lib/precio-plan'

const CRON_SECRET = process.env.CRON_SECRET

/* ⚠ EL INTERRUPTOR. Sin `COBRO_RECURRENTE_ACTIVO=1` esto no cobra nada y lo
   dice. Se puede programar desde ya y encenderlo cuando esté probado con una
   tarjeta de verdad: un cron que cobra no se estrena a ciegas. */
const ENCENDIDO = process.env.COBRO_RECURRENTE_ACTIVO === '1'

/* El tope de rechazos es `MAX_FALLOS` y las noches las elige `tocaIntentar`
   (lib/cobro-automatico.js): espaciadas, porque un Nequi sin saldo rechazado
   todos los días ensucia la reputación del comercio. */

/* Un intento por pasada como mucho. Sin esto, dos ejecuciones de la misma
   pasada cobrarían dos veces. Son 12 h y no 20 desde el 13 nov 2026: el
   reintento de las 22:00 sale 14 h después del cobro de las 08:00. */
const HORAS_ENTRE_INTENTOS = 12

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

  /* Sin parámetro, la de la mañana: es la línea del crontab de siempre. */
  const pasada = new URL(req.url).searchParams.get('pasada') === 'noche' ? 'noche' : 'manana'
  const ahora = new Date()
  const desdeIntento = new Date(ahora.getTime() - HORAS_ENTRE_INTENTOS * 3600000)
  const hastaVence = new Date(ahora.getTime() + HORAS_DE_ANTICIPO * 3600000)
  const desdeVence = new Date(ahora.getTime() - HORAS_DE_REINTENTO * 3600000)
  const res = { pasada, candidatos: 0, cobrados: 0, rechazados: 0, errores: 0, saltados: 0, enCurso: 0, agotados: 0, hoyNo: 0, otraPasada: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        /* ⚠ SIN FILTRAR POR RECHAZO NI POR FALLOS: quien ya fue rechazado es
           justo a quien hay que volver a intentar. El tope se mira abajo, sobre
           el rechazo del periodo que toca. */
        cobroAutomatico: true,
        wompiFuentePagoId: { not: null },
        /* Un intento al día: `null` (nunca intentado) también entra. */
        OR: [
          { cobroUltimoIntento: null },
          { cobroUltimoIntento: { lt: desdeIntento } },
        ],
        /* ⚠ LA VENTANA: VENCE EN LAS PRÓXIMAS 48 H, O VENCIÓ HACE MENOS DE 72.
           Antes era «ya venció» y fallaba dos veces (12 sep 2026):
           · un plan que vence a las 13:10 no se cobraba a las 13:00, y a las
             13:10 el cliente quedaba fuera con el cobro puesto;
           · al día siguiente, a las 08:00, `cron/suscripciones` lo marca
             `vencida`, y aquí solo se buscaba `activa`: NO SE COBRABA NUNCA.
           Cobrar antes no le cuesta días —`activarPlanPagado` extiende desde la
           fecha de vencimiento— y lo `vencida` entra para que los reintentos
           existan de verdad. */
        suscripciones: {
          some: {
            estado: { in: ['activa', 'vencida'] },
            montoCOP: { gt: 0 },
            fechaVencimiento: { lte: hastaVence, gte: desdeVence },
          },
        },
      },
      select: {
        id: true, nombre: true, wompiFuentePagoId: true, wompiFuenteEmail: true,
        cobroAutomatico: true, cobroFallos: true, cobroUltimoIntento: true,
        cobroRefPendiente: true, cobroTxPendiente: true, cobroRechazoVence: true,
        /* ⚠ SIN ESTOS, `montoDelCobro` cobra lista a todos EN SILENCIO: el
           país sale `co` y el preferencial no existe. */
        ...selectPrecio,
        suscripciones: {
          where: { estado: { in: ['activa', 'vencida'] }, montoCOP: { gt: 0 } },
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          select: selectPago,
        },
      },
    })

    for (let org of orgs) {
      const sub = org.suscripciones?.[0]
      if (!sub || !org.wompiFuenteEmail) { res.saltados++; continue }

      /* ⚠ LA VENTANA SE MIRA OTRA VEZ, EN LA MÁS RECIENTE. El `some` de arriba
         casa con CUALQUIER suscripción del negocio: una vieja que quedó dentro
         de la ventana lo metería aquí aunque la vigente ya esté pagada, y se le
         cobraría dos veces. La que decide es la última, que es la que el
         webhook extiende al aprobarse. */
      const vence = new Date(sub.fechaVencimiento)
      if (vence > hastaVence || vence < desdeVence) { res.saltados++; continue }

      /* Un cobro anterior que no terminó de saberse: primero averiguar cómo
         acabó. Si sigue en el aire, hoy no se manda otro. */
      if (org.cobroRefPendiente) {
        const estado = await reconciliar(org)
        if (estado === 'aprobada') { res.saltados++; continue }
        if (estado !== 'libre') { res.enCurso++; continue }
        org = { ...org, ...(await prisma.organization.findUnique({
          where: { id: org.id },
          select: { cobroFallos: true, cobroRechazoVence: true },
        })) }
      }

      const vigente = rechazoVigente(org, sub.fechaVencimiento)
      /* La mañana cobra lo normal; la noche, solo los reintentos y en las
         noches del calendario. El tope de `MAX_FALLOS` va ahí dentro. */
      const toca = quePasaEnLaPasada({ pasada, vigente, fallos: org.cobroFallos, vence, ahora })
      if (toca === 'agotado') { res.agotados++; continue }
      if (toca === 'hoy-no') { res.hoyNo++; continue }
      if (toca !== 'cobrar') { res.otraPasada++; continue }
      res.candidatos++

      /* ⚠ UN MES, AL PRECIO DE ESE MES. Hasta el 12 sep 2026 aquí iba
         `sub.montoCOP`, lo último pagado: quien pagó un trimestre recibía el
         cobro del trimestre entero y el webhook le activaba UN mes; y un
         precio especial no terminaba nunca. Lo decide lib/precio-plan.js. */
      const precio = montoDelCobro({ org, plan: sub.plan, pagada: sub, ultima: sub, ahora })
      if (!(precio.monto > 0)) { res.saltados++; continue }
      if (precio.porRevisar) {
        console.warn(`[cobro-recurrente] PRECIO POR REVISAR "${org.nombre}" (${org.id}): se cobra $${precio.monto} y la lista es $${precio.lista}`)
      }

      /* La referencia lleva el MISMO formato que el pago manual, porque quien
         la lee es el mismo webhook: la escribe `lanzarCobro` con
         `referenciaDeCobro`. El intento se apunta ANTES de llamar a Wompi. */
      const r = await lanzarCobro({
        org,
        plan: sub.plan,
        montoCOP: precio.monto,
        /* Un rechazo de otro periodo no gasta intentos de éste. */
        reiniciarFallos: !vigente,
        origen: 'cron',
      })

      if (r.resultado === 'enviado') res.cobrados++
      else if (r.resultado === 'rechazado') {
        res.rechazados++
        console.warn(`[cobro-recurrente] RECHAZADO "${org.nombre}" (${(vigente ? org.cobroFallos : 0) + 1}/${MAX_FALLOS}): ${r.motivo}`)
      } else if (r.resultado === 'pendiente') res.enCurso++
      else res.errores++
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON cobro-recurrente]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
