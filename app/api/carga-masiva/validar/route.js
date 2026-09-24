// app/api/carga-masiva/validar/route.js
// La sesión vive aquí; la validación, en lib/importar-cartera.js.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { validarCartera }   from '@/lib/importar-cartera'

export async function POST(request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.organizationId) {
      return Response.json({ error: 'No autorizado' }, { status: 401 })
    }
    if (session.user.rol !== 'owner') {
      return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })
    }

    const { organizationId, plan } = session.user
    const { filas } = await request.json()

    if (!Array.isArray(filas) || filas.length === 0) {
      return Response.json({ error: 'No hay datos para validar' }, { status: 400 })
    }
    if (filas.length > 500) {
      return Response.json({ error: 'Máximo 500 filas por importación' }, { status: 400 })
    }

    return Response.json(await validarCartera({ organizationId, plan, filas }))
  } catch (err) {
    console.error('[POST /api/carga-masiva/validar]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
