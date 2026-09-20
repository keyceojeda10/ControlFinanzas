import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAsistenteUsage } from '@/lib/rate-limit'
import { PLANES_CONFIG, planTieneIA } from '@/lib/planes'
import { getCachedContexto } from '@/lib/asistente-cache'
import { getUtcOffset } from '@/lib/i18n'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { organizationId: orgId, plan, rol } = session.user

  if (!planTieneIA(plan) && rol !== 'cobrador') {
    return NextResponse.json({ limite: 0, usado: 0, restantes: 0, alertas: null })
  }

  const limite = PLANES_CONFIG[plan]?.aiMensajesDia ?? 20
  const { used } = getAsistenteUsage(orgId)
  const restantes = Math.max(0, limite - used)

  // Alertas del contexto cacheado — costo ~0 si ya está en cache, null si no
  let alertas = null
  try {
    const ctx = getCachedContexto(orgId)
    if (ctx) {
      /* Contra lo que TOCA cobrar hoy (la cifra del Inicio), no contra la suma de
         todas las cuotas de la cartera: con aquello este porcentaje no pasaba del
         5 % ningún día y la sugerencia «solo llevo X % de mi meta» salía siempre.
         Un día sin cobro no tiene meta: 100, y la sugerencia no sale. */
      const pctCobroHoy = ctx.kpis.esperadoHoy > 0
        ? Math.round((ctx.kpis.cobroHoy / ctx.kpis.esperadoHoy) * 100)
        : 100
      alertas = {
        clientesMora: ctx.kpis.clientesMora,
        clientesSinRuta: ctx.alertas.clientesSinRuta,
        prestamosSinPagos: ctx.alertas.prestamosSinPagos,
        pctCobroHoy,
        diaSemana: new Date(Date.now() - Math.abs(getUtcOffset(session.user.country ?? 'co')) * 60 * 60 * 1000).getDay(),
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: { limite, usado: used, restantes, alertas } })
}
