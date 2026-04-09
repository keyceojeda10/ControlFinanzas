// app/api/auth/estado-verificacion/route.js
// Endpoint ligero para consultar si el email del usuario autenticado está verificado.
// El banner lo consulta porque el JWT no se actualiza durante la sesión.
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return Response.json({ verificado: true }) // sin sesión, no bloquear
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerificado: true },
  })

  return Response.json({ verificado: user?.emailVerificado ?? true })
}
