// lib/carga-asesor/sesion-dueno.js — quién puede tocar «Cargar mi cartera».
//
// Solo el DUEÑO de la cuenta ve y toca SU solicitud. Las cuatro rutas de
// `app/api/carga-asesor/*` pasan por aquí; ninguna debe comparar el rol por su
// cuenta (el día que una se olvide, un cobrador cargaría la cartera). Y todo lo
// que se busque después va con `session.user.organizationId`, nunca con un id
// que mande el cuerpo.
//
// Vive en `lib/` y no en `route.js` porque un archivo de ruta de Next solo puede
// exportar los métodos HTTP: otra exportación rompe el build.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

/**
 * @returns {Promise<{ session: object } | { error: Response }>} la sesión del
 * dueño, o la respuesta 401 (sin sesión) / 403 (no es el dueño) lista para devolver.
 */
export async function sesionDueno() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return { error: Response.json({ error: 'No autorizado' }, { status: 401 }) }
  if (session.user.rol !== 'owner') return { error: Response.json({ error: 'Solo el administrador de la cuenta puede pedir la carga' }, { status: 403 }) }
  return { session }
}
