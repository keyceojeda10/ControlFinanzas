import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { PLANES_CONFIG }    from '@/lib/planes'
import { getAsistenteUsage } from '@/lib/rate-limit'
import { obtenerRutasPermitidas, obtenerUsuariosPermitidos } from '@/lib/limites-plan'

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
      select: { plan: true, cobradoresExtra: true, rutasExtra: true },
    }),
  ])

  // Prioridad: suscripcion activa > org.plan > session.plan > starter
  const planReal = sub?.plan || org?.plan || session.user.plan || 'starter'
  const config = PLANES_CONFIG[planReal] || PLANES_CONFIG.starter

  const limiteRutas    = config.maxRutas    + (org?.rutasExtra ?? 0)
  const limiteUsuarios = config.maxUsuarios + (org?.cobradoresExtra ?? 0)

  const [clientes, usuarios, rutas, rutasPermitidasSet, usuariosPermitidosSet] = await Promise.all([
    prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } }),
    prisma.user.count({ where: { organizationId, activo: true } }),
    prisma.ruta.count({ where: { organizationId, activo: true } }),
    obtenerRutasPermitidas(organizationId),
    obtenerUsuariosPermitidos(organizationId),
  ])

  const aiUsage = getAsistenteUsage(organizationId)

  const excedeAlgo = clientes > config.maxClientes || usuarios > limiteUsuarios || rutas > limiteRutas

  return Response.json({
    plan: planReal,
    clientes:       { usado: clientes, limite: config.maxClientes },
    usuarios:       { usado: usuarios, limite: limiteUsuarios },
    rutas:          { usado: rutas,    limite: limiteRutas },
    lucasMensajes:  { usado: aiUsage.used, limite: config.aiMensajesDia },
    excedeAlgo,
    rutasPermitidas:   [...rutasPermitidasSet],
    usuariosPermitidos: [...usuariosPermitidosSet],
  })
}
