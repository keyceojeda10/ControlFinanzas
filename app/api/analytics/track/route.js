// app/api/analytics/track/route.js — Endpoint para tracking client-side
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { trackEvent } from '@/lib/analytics'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  // Allow tracking even without auth (for login/register pages)
  const body = await request.json()
  const { evento, pagina, metadata } = body

  if (!evento) return Response.json({ error: 'evento requerido' }, { status: 400 })

  trackEvent({
    organizationId: session?.user?.organizationId,
    userId: session?.user?.id,
    evento,
    pagina,
    metadata,
  })

  return Response.json({ ok: true })
}
