// Dos funciones en un cron:
// 1) PRE-VENCIMIENTO: 3 dias antes, envia recordatorio (waPreVencSent)
// 2) POST-VENCIMIENTO: plan ya vencio, envia link de renovacion (waChurnSent)
// Cubre trials Y pagantes con uso real (>=1 prestamo o >=1 cliente).
// Corre diariamente a las 9am.

import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as wa from '@/lib/bot/whatsapp-cloud'
import { cronLimiter, getClientIp } from '@/lib/rate-limit'

/* ⚠ UNA VEZ POR CICLO, NO UNA VEZ EN LA VIDA.
 *
 * `waPreVencSent` y `waChurnSent` eran booleanos: quien gastaba el aviso no lo
 * volvía a recibir NUNCA, aunque renovara y volviera a vencer. Se resetean al
 * pagar (`activarPlanPagado`), pero con un booleano no hay forma de saber si el
 * `true` que ves es de este vencimiento o de uno de hace tres meses.
 *
 * Medido el 1 sep 2026: 28 organizaciones lo tenían gastado, y **5 de las 12
 * que vencían esa semana estaban silenciadas** — una de ellas venciendo ese
 * mismo día. Y el desequilibrio que lo delata: en cinco días salió UN aviso de
 * «vas a vencer» y VEINTIDÓS de «ya venciste». Estábamos avisando tarde.
 *
 * Ahora manda la fecha. Veinte días de enfriamiento: no repite dentro del mismo
 * ciclo mensual y sí deja avisar en el siguiente. Los booleanos se siguen
 * escribiendo porque el panel de retención los pinta. */
const DIAS_ENFRIAMIENTO = 20

const CRON_SECRET = process.env.CRON_SECRET
/* Por variable de entorno para cambiar de plantilla SIN desplegar: la v3
   («si dejas guardado tu Nequi, se renueva solo») quedó enviada a Meta el
   6 sep 2026 y hasta que la aprueben no se puede usar. Cuando esté APPROVED:
   `WA_TEMPLATE_PREVENC=plan_por_vencer_v3` en el .env del VPS y
   `pm2 reload cf --update-env`. Sin la variable, la v2 de siempre. */
const TEMPLATE_PREVENC = process.env.WA_TEMPLATE_PREVENC || 'plan_por_vencer_v2'
const TEMPLATE_VENCIDO = 'plan_vencido_v2'
const TEMPLATE_LANG = process.env.WHATSAPP_TEMPLATE_LANG || 'es'

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

  if (!wa.configurado()) {
    return NextResponse.json({ error: 'WhatsApp no configurado' }, { status: 500 })
  }

  const ahora = new Date()
  const en3d = new Date(ahora.getTime() + 3 * 86400000)
  const hace7d = new Date(ahora.getTime() - 7 * 86400000)
  const desdeAviso = new Date(ahora.getTime() - DIAS_ENFRIAMIENTO * 86400000)
  /* Una fecha `null` es «nunca avisado con el sistema nuevo»: entra. Es lo que
     desbloquea a los que quedaron colgados con el booleano en `true`. */
  const puedeRecibir = (campo) => ({
    OR: [{ [campo]: null }, { [campo]: { lt: desdeAviso } }],
  })
  const res = {
    preVenc: { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 },
    vencido: { candidatos: 0, enviados: 0, sinTelefono: 0, errores: 0 },
  }

  try {
    // --- PRE-VENCIMIENTO: vence en los proximos 3 dias ---
    // Solo subs pagadas (montoCOP > 0). Los trials los cubre onboarding-whatsapp
    // dia 10 — sin este filtro ambos crons enviarian al mismo trial a las 9am.
    const orgsPre = await prisma.organization.findMany({
      where: {
        activo: true,
        ...puedeRecibir('waPreVencSentAt'),
        users: { none: { email: { in: EMAILS_INTERNOS } } },
        suscripciones: {
          some: {
            estado: 'activa',
            fechaVencimiento: { gte: ahora, lte: en3d },
            montoCOP: { gt: 0 },
          },
        },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true },
          take: 1,
        },
        _count: { select: { prestamos: true, clientes: true } },
        suscripciones: {
          orderBy: { fechaVencimiento: 'desc' },
          take: 1,
          select: { fechaVencimiento: true, plan: true },
        },
      },
    })

    for (const org of orgsPre) {
      const owner = org.users[0]
      if (!owner) continue
      if (org._count.prestamos < 1 && org._count.clientes < 1) continue

      res.preVenc.candidatos++
      const tel = owner.telefono ?? org.telefono
      if (!tel) { res.preVenc.sinTelefono++; continue }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        const dias = Math.ceil((new Date(org.suscripciones[0].fechaVencimiento) - ahora) / 86400000)
        await wa.sendTemplate(tel, TEMPLATE_PREVENC, [nombre, String(dias)], TEMPLATE_LANG)

        await prisma.organization.update({
          where: { id: org.id },
          data: { waPreVencSent: true, waPreVencSentAt: ahora },
        })
        res.preVenc.enviados++
        console.log(`[Churn WA] Pre-venc enviado a ${owner.nombre} (${org.nombre}) — ${dias}d`)
      } catch (e) {
        res.preVenc.errores++
        console.error(`[Churn WA] Pre-venc error ${org.nombre}: ${e.message}`)
      }
    }

    // --- POST-VENCIMIENTO: ya vencio en los ultimos 7 dias ---
    // Excluir orgs que YA tienen una sub activa (puede pasar tras renovacion
    // manual admin, que crea sub nueva y deja la vieja con fecha expirada).
    const orgsVenc = await prisma.organization.findMany({
      where: {
        activo: true,
        ...puedeRecibir('waChurnSentAt'),
        users: { none: { email: { in: EMAILS_INTERNOS } } },
        suscripciones: {
          some: {
            fechaVencimiento: { lt: ahora, gte: hace7d },
          },
          none: {
            estado: 'activa',
          },
        },
      },
      include: {
        users: {
          where: { rol: 'owner' },
          select: { nombre: true, telefono: true },
          take: 1,
        },
        _count: { select: { prestamos: true, clientes: true } },
      },
    })

    for (const org of orgsVenc) {
      const owner = org.users[0]
      if (!owner) continue
      if (org._count.prestamos < 1 && org._count.clientes < 1) continue

      res.vencido.candidatos++
      const tel = owner.telefono ?? org.telefono
      if (!tel) { res.vencido.sinTelefono++; continue }

      try {
        const nombre = (owner.nombre || 'amigo').split(' ')[0]
        await wa.sendTemplate(tel, TEMPLATE_VENCIDO, [nombre], TEMPLATE_LANG)

        await prisma.organization.update({
          where: { id: org.id },
          data: { waChurnSent: true, waChurnSentAt: ahora },
        })
        res.vencido.enviados++
        console.log(`[Churn WA] Vencido enviado a ${owner.nombre} (${org.nombre})`)
      } catch (e) {
        res.vencido.errores++
        console.error(`[Churn WA] Vencido error ${org.nombre}: ${e.message}`)
      }
    }

    return NextResponse.json({ ok: true, ...res })
  } catch (error) {
    console.error('[CRON churn-whatsapp]', error)
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}
