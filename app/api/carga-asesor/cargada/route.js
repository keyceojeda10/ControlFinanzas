// app/api/carga-asesor/cargada/route.js — lo que el dueño crea de lo que se leyó.
//
// POST { solicitudId, filaId, clienteId, prestamoId }
//        → apunta que esa fila ya es un préstamo (`apuntarCreada`). Idempotente
//          por `filaId`. Se apunta en cualquier estado menos «aprobada» y
//          «rechazada» (también en «ayuda», leyendo o recibida): el préstamo YA
//          existe, y no apuntarlo lo deja suelto y a un toque de crearse dos
//          veces.
// POST { solicitudId, terminar: true, quitadas?: string[] }
//        → el dueño terminó (`terminarCarga`). Solo cierra si no queda ninguna
//          fila por cargar (descontadas las que quitó): si quedan, 200 con
//          `{ ok: false, quedan }`. En «ayuda» es 409: la tiene Carlos.
//
// Todo con la organización de la SESIÓN; lo que traiga el cuerpo sobre el negocio
// no cuenta.

import { prisma } from '@/lib/prisma'
import { sesionDueno } from '@/lib/carga-asesor/sesion-dueno'
import { apuntarCreada, terminarCarga } from '@/lib/carga-asesor/solicitud'
import { esId } from '@/lib/ids'

export const runtime = 'nodejs'

const falla = (error, status) => Response.json({ error }, { status })
// `terminarCarga` y `apuntarCreada` dicen `{ error, status }` cuando algo impide seguir.
const respuesta = (r) => (r.error ? falla(r.error, r.status ?? 400) : Response.json(r))

export async function POST(request) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const organizationId = session.user.organizationId

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return falla('Cuerpo no válido', 400)
  // Los ids van a un `where` de Prisma: un objeto ahí es un filtro, no un id.
  const { solicitudId, terminar } = body
  if (!esId(solicitudId)) return falla('Falta la solicitud', 400)

  const terminando = terminar === true
  const { filaId, clienteId, prestamoId } = body
  if (!terminando && !(esId(filaId) && esId(clienteId) && esId(prestamoId))) return falla('Faltan la fila, el cliente o el préstamo', 400)
  if (terminando && body.quitadas != null && !Array.isArray(body.quitadas)) return falla('Las filas quitadas deben ser una lista', 400)

  // La solicitud tiene que ser de SU negocio (nunca por id a secas).
  const sol = await prisma.solicitudCarga.findFirst({ where: { id: solicitudId, organizationId }, select: { id: true, estado: true } })
  if (!sol) return falla('No existe', 404)

  if (!terminando) {
    return respuesta(await apuntarCreada({ id: sol.id, organizationId, filaId, clienteId, prestamoId }))
  }

  // Terminar con Carlos mirándola no se puede (el préstamo que YA existe sí se apunta, arriba).
  if (sol.estado === 'ayuda') return falla('Carlos la está revisando: no se puede terminar hasta que te la devuelva', 409)
  const quitadas = (body.quitadas ?? []).filter((q) => typeof q === 'string')
  return respuesta(await terminarCarga({ id: sol.id, organizationId, quitadas }))
}
