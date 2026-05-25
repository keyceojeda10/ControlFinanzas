import { getServerSession } from 'next-auth'
import { authOptions }      from '@/app/api/auth/[...nextauth]/route'
import prisma               from '@/lib/prisma'
import { PLANES_CONFIG }    from '@/lib/planes'
import { getAsistenteUsage } from '@/lib/rate-limit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { organizationId, plan } = session.user
  const config = PLANES_CONFIG[plan] || PLANES_CONFIG.starter

  // Superadmin no tiene org — devolver limites del plan con uso 0
  if (!organizationId) {
    return Response.json({
      clientes:      { usado: 0, limite: config.maxClientes },
      usuarios:      { usado: 0, limite: config.maxUsuarios },
      rutas:         { usado: 0, limite: config.maxRutas },
      lucasMensajes: { usado: 0, limite: config.aiMensajesDia },
    })
  }

  const [clientes, usuarios, rutas] = await Promise.all([
    prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } }),
    prisma.user.count({ where: { organizationId } }),
    prisma.ruta.count({ where: { organizationId, activo: true } }),
  ])

  const aiUsage = getAsistenteUsage(organizationId)

  return Response.json({
    clientes:       { usado: clientes,       limite: config.maxClientes },
    usuarios:       { usado: usuarios,       limite: config.maxUsuarios },
    rutas:          { usado: rutas,           limite: config.maxRutas },
    lucasMensajes:  { usado: aiUsage.used,   limite: config.aiMensajesDia },
  })
}
