// app/api/carga-asesor/route.js — «Cargar mi cartera con asesor» (bloque 4).
//
// GET  → cómo va su carga (la última de los últimos 60 días).
// POST → sube fotos, Excel o PDF (campo `archivos`, varios) y una nota opcional.
//        Se guardan, se confirma «recibido» y se leen en segundo plano al área de
//        espera. Ver lib/carga-asesor/solicitud.js.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { guardarArchivos, confirmarRecibida, procesarSolicitud, archivosDe, resumenDeSolicitud, MAX_ARCHIVOS } from '@/lib/carga-asesor/solicitud'

export const runtime = 'nodejs'

// Veinte tandas por hora y negocio sobran para subir un cuaderno por partes.
const subidas = rateLimit('carga-asesor', 20, 60 * 60 * 1000)

function vista(sol) {
  if (!sol) return null
  const r = resumenDeSolicitud(sol)
  return {
    id: sol.id,
    estado: sol.estado,
    creada: sol.createdAt,
    aprobada: sol.aprobadaAt,
    archivos: archivosDe(sol).map((a) => ({ n: a.n, nombre: a.nombre, tipo: a.tipo })),
    // Al dueño solo se le dice lo que quedó cargado, no lo leído a medias.
    cargado: r?.importado ? { clientes: r.importado.clientesCreados, prestamos: r.importado.prestamosCreados, enLaCalle: r.importado.enLaCalle } : null,
  }
}

async function sesionDueno() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return { error: Response.json({ error: 'No autorizado' }, { status: 401 }) }
  if (session.user.rol !== 'owner') return { error: Response.json({ error: 'Solo el administrador de la cuenta puede pedir la carga' }, { status: 403 }) }
  return { session }
}

export async function GET() {
  const { session, error } = await sesionDueno()
  if (error) return error
  const sol = await prisma.solicitudCarga.findFirst({
    where: { organizationId: session.user.organizationId, createdAt: { gte: new Date(Date.now() - 60 * 86400000) } },
    orderBy: { createdAt: 'desc' },
  })
  return Response.json({ solicitud: vista(sol), maxArchivos: MAX_ARCHIVOS })
}

export async function POST(request) {
  const { session, error } = await sesionDueno()
  if (error) return error
  const organizationId = session.user.organizationId
  if (!subidas(organizationId).ok) {
    return Response.json({ error: 'Demasiadas subidas seguidas. Espera un rato.' }, { status: 429 })
  }

  const form = await request.formData().catch(() => null)
  if (!form) return Response.json({ error: 'No llegó ningún archivo' }, { status: 400 })
  const archivos = []
  for (const f of form.getAll('archivos')) {
    if (!f || typeof f.arrayBuffer !== 'function') continue
    archivos.push({ buffer: Buffer.from(await f.arrayBuffer()), nombre: f.name || '' })
  }
  const nota = String(form.get('nota') ?? '').trim().slice(0, 1000) || null

  const r = await guardarArchivos(organizationId, archivos, { origen: 'web', nota })
  if (!r.solicitud) return Response.json({ error: r.error, rechazados: r.rechazados }, { status: 400 })

  if (r.nueva && r.nuevos > 0) await confirmarRecibida(r.solicitud)
  /* La lectura va aparte: treinta fotos con Gemini tardan minutos y la persona
     no tiene por qué esperarlas. Si el proceso muere (un despliegue), el cron de
     cada hora la retoma (`vueltaDeCargas`). */
  if (r.nuevos > 0) void procesarSolicitud(r.solicitud.id).catch((e) => console.error('[carga-asesor]', e?.message))

  return Response.json({ solicitud: vista(r.solicitud), nuevos: r.nuevos, rechazados: r.rechazados })
}
