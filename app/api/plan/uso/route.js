import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES_CONFIG }    from '@/lib/planes'
import { getAsistenteUsage } from '@/lib/rate-limit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { organizationId } = session.user

  // Superadmin no tiene org
  if (!organizationId) {
    const config = PLANES_CONFIG.professional
    return Response.json({
      plan: 'professional',
      clientes:      { usado: 0, limite: config.maxClientes },
      usuarios:      { usado: 0, limite: config.maxUsuarios },
      rutas:         { usado: 0, limite: config.maxRutas },
      lucasMensajes: { usado: 0, limite: config.aiMensajesDia },
    })
  }

  // Leer el plan REAL desde la suscripcion en DB, no del JWT
  const [sub, org] = await Promise.all([
    prisma.suscripcion.findFirst({
      where: {
        organizationId,
        OR: [{ mpStatus: null }, { mpStatus: { not: 'pending' } }],
      },
      orderBy: { fechaVencimiento: 'desc' },
      select: { plan: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { plan: true },
    }),
  ])

  // Prioridad: suscripcion activa > org.plan > session.plan > starter
  const planReal = sub?.plan || org?.plan || session.user.plan || 'starter'
  const config = PLANES_CONFIG[planReal] || PLANES_CONFIG.starter

  const [clientes, usuarios, rutas] = await Promise.all([
    prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.ruta.count({ where: { organizationId, activo: true } }),
  ])

  const aiUsage = getAsistenteUsage(organizationId)

  return Response.json({
    plan: planReal,
    clientes:       { usado: clientes,       limite: config.maxClientes },
    usuarios:       { usado: usuarios,       limite: config.maxUsuarios },
    rutas:          { usado: rutas,           limite: config.maxRutas },
    lucasMensajes:  { usado: aiUsage.used,   limite: config.aiMensajesDia },
  })
}
