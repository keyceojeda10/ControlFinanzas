import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getAsistenteUsage } from '@/lib/rate-limit'
import { PLANES_CONFIG, planTieneIA } from '@/lib/planes'
import { getCachedContexto } from '@/lib/asistente-cache'

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
      const pctCobroHoy = ctx.kpis.cuotaDiariaEsperada > 0
        ? Math.round((ctx.kpis.cobroHoy / ctx.kpis.cuotaDiariaEsperada) * 100)
        : 100
      alertas = {
        clientesMora: ctx.kpis.clientesMora,
        clientesSinRuta: ctx.alertas.clientesSinRuta,
        prestamosSinPagos: ctx.alertas.prestamosSinPagos,
        pctCobroHoy,
        diaSemana: new Date(Date.now() - 5 * 60 * 60 * 1000).getDay(),
      }
    }
  } catch {}

  return NextResponse.json({ success: true, data: { limite, usado: used, restantes, alertas } })
}
