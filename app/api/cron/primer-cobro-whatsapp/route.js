// app/api/cron/primer-cobro-whatsapp/route.js
//
// ══ EL HUECO QUE TAPA ══════════════════════════════════════════════════════
//
// `activacion-whatsapp` habla con quien se registró y NO creó ningún préstamo
// (`prestamos: { none: {} }`). El siguiente aviso que existe es
// `recovery-whatsapp`, que salta cuando se le VENCE LA PRUEBA: semanas después
// y con tono comercial.
//
// Entre los dos hay un escalón sin nadie: el que SÍ prestó y nunca registró un
// cobro. Medido en producción el 31 ago 2026, con 14 días de margen para que
// les diera tiempo de cobrar:
//
//   · 83 negocios prestaron y NUNCA registraron un cobro
//   · el 80 % no volvió después del primer día
//   · tienen 2,6 clientes de media; los que sobreviven, 41,9
//   · el 75 % creó UN solo préstamo
//   · CERO habían recibido el aviso de activación — quedan fuera por diseño,
//     porque ya crearon un préstamo
//   · caen unos 20 nuevos cada mes
//
// O sea: el sistema toma «creó un préstamo» por «ya arrancó», y los datos dicen
// que no. Lo que separa a los que siguen es registrar cobros y tener la cartera
// dentro.
//
// ⚠ VA AL DÍA 2, NO A LA SEMANA. Si el 80 % muere el primer día, un aviso
// tardío llega cuando ya cerraron la app y no se acuerdan de haberla abierto.
//
// ── APAGADO HASTA QUE HAYA PLANTILLA ───────────────────────────────────────
//
// Las plantillas aprobadas que hay —`activacion_sin_actividad`,
// `activacion_con_clientes`, `recuperacion_trial`— están escritas para quien NO
// ha prestado, así que ninguna sirve aquí. Hace falta una nueva aprobada por
// Meta.
//
// Mientras `WHATSAPP_TEMPLATE_PRIMER_COBRO` no esté puesta, esto NO MANDA NADA
// y lo dice en su respuesta. Así se puede programar desde ya sin riesgo: el día
// que Meta apruebe la plantilla, se pone la variable y empieza solo.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

const CRON_SECRET = process.env.CRON_SECRET
const TEMPLATE = process.env.WHATSAPP_TEMPLATE_PRIMER_COBRO || ''
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'
const SOPORTE = '301 199 3001'

/* La misma lista que `activacion-whatsapp`: las cuentas de casa no reciben
   avisos de activación. */
const EMAILS_INTERNOS = [
  'keycejob@gmail.com', 'ccaojd@gmail.com', 'owner@test.com',
  'controlfinanzasgmail@gmail.com', 'serviteclgx1@gmail.com',
]

export async function POST(req) {
  const secret = req.headers.get('x-cron-secret')
  if (!CRON_SECRET || secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }
  const rl = cronLimiter(getClientIp(req))
  if (!rl.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 })

  /* ⚠ EL INTERRUPTOR. Antes que nada y antes de tocar la base: sin plantilla no
     hay nada que mandar, y marcar `waPrimerCobroSent` sin haber mandado nada
     quemaría el único aviso que tiene cada negocio. */
  if (!TEMPLATE) {
    return NextResponse.json({
      ok: true, apagado: true,
      motivo: 'falta WHATSAPP_TEMPLATE_PRIMER_COBRO (la plantilla aún no está aprobada por Meta)',
    })
  }
  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 500 })
  }

  const ahora = new Date()
  const hace48h = new Date(ahora.getTime() - 48 * 3600000)
  const hace6d = new Date(ahora.getTime() - 6 * 24 * 3600000)
  const res = { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 }

  try {
    const orgs = await prisma.organization.findMany({
      where: {
        activo: true,
        waPrimerCobroSent: false,
        /* ⚠ PRESTÓ HACE ENTRE 2 Y 6 DÍAS.
           Menos de 2 no da tiempo ni a un cobro diario; más de 6 y el mensaje
           llega a quien ya se olvidó de que abrió la cuenta. La ventana también
           evita reventar el primer día que esto se encienda: solo entran los que
           están justo en ese tramo, no los 83 de golpe. */
        prestamos: {
          some: { createdAt: { gte: hace6d, lte: hace48h }, estado: 'activo' },
        },
        /* El «ninguno de sus préstamos tiene un cobro» NO va aquí: ver el
           comentario dentro del bucle, que explica por qué no se puede. */
        users: { none: { email: { in: EMAILS_INTERNOS } } },
      },
      include: {
        users: { where: { rol: 'owner' }, select: { nombre: true, telefono: true }, take: 1 },
        _count: { select: { clientes: true } },
      },
    })

    for (const org of orgs) {
      /* ⚠ EL «CERO COBROS» SE COMPRUEBA AQUÍ Y NO EN EL `where`.
         Prisma no deja anidar «ninguno de mis préstamos tiene algún pago» junto
         a un `some` sobre la misma relación sin que las dos condiciones se
         apliquen al MISMO préstamo. Escrito arriba, el filtro habría dejado
         pasar a quien tiene un préstamo nuevo sin cobros y otro viejo cobrado
         —justo a quien no hay que molestar—. Una consulta por candidato es
         barata: son unas decenas al día. */
      const cobros = await prisma.pago.count({ where: { prestamo: { organizationId: org.id } } })
      if (cobros > 0) continue

      const owner = org.users[0]
      if (!owner) continue
      res.candidatos++

      const tel = owner.telefono ?? org.telefono
      if (!tel) { res.sinTelefono++; continue }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        await wa.sendTemplate(tel, TEMPLATE, [nombre, SOPORTE], TEMPLATE_LANG)

        /* La marca se pone DESPUÉS del envío, nunca antes: si el envío falla,
           el negocio sigue siendo candidato mañana en vez de quedarse sin su
           único aviso. */
        await prisma.organization.update({
          where: { id: org.id },
          data: { waPrimerCobroSent: true },
        })
        res.enviados++
        console.log(`[Primer cobro WA] Enviado a ${owner.nombre} (${org.nombre}) — ${org._count.clientes} clientes, 0 cobros`)
      } catch (e) {
        res.errores++
        console.error(`[Primer cobro WA] Error ${org.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON primer-cobro-whatsapp]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
