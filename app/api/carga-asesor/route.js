// app/api/carga-asesor/route.js — «Cargar mi cartera con asesor» (bloque 4).
//
// GET  → cómo va su carga (la última de los últimos 60 días) y, mientras la
//        revisa, lo que el sistema leyó (`revision`). Con `?solo=estado`, solo
//        la solicitud (lo que mira «Crear» antes de cada tanda).
// POST → sube fotos, Excel o PDF (campo `archivos`, varios) y una nota opcional.
//        Se guardan, se confirma «recibido» y se leen en segundo plano al área de
//        espera. Ver lib/carga-asesor/solicitud.js.

import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
import { validarCartera } from '@/lib/importar-cartera'
import { sesionDueno } from '@/lib/carga-asesor/sesion-dueno'
import { limpiarFila } from '@/lib/carga-asesor/filas'
import { filasParaLote, baseDesdeNegocio, problemasPorArchivo } from '@/lib/carga-asesor/al-lote'
import {
  guardarArchivos, confirmarRecibida, procesarSolicitud, archivosDe, resumenDeSolicitud, creadasDe, filasPendientes,
  ESTADOS_EDITABLES, MAX_ARCHIVOS,
} from '@/lib/carga-asesor/solicitud'

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

/* Donde el dueño ve lo que el sistema leyó: con él (`en_revision`), con Carlos
   (`ayuda`) y mientras se lee (`recibida`, `leyendo`: las filas pueden ser pocas o
   ninguna, y los archivos que ya se leyeron enseñan lo que falló). */
const CON_REVISION = [...ESTADOS_EDITABLES, 'recibida', 'leyendo']

/**
 * Lo que el dueño revisa: las filas POR CARGAR (las que ya creó o quitó no
 * vuelven), en la forma que trabaja `LoteFotos`, y con qué base y cuánto espacio.
 *
 * ⚠ `bloqueada`: solo en `en_revision` puede crear. En «ayuda» la tiene Carlos y
 * en «leyendo»/«recibida» las filas todavía cambian; si el dueño creara ahora, lo
 * suyo podría chocar con lo que importe Carlos (préstamos dobles).
 */
async function revisionDe(sol) {
  const org = await prisma.organization.findUnique({
    where: { id: sol.organizationId },
    select: { plan: true, tasaDefault: true, frecuenciaDefault: true, modoInteresDefault: true },
  })
  const pendientes = filasPendientes(sol)

  /* El espacio se mide sobre lo que FALTA por cargar (lo creado ya cuenta en los
     clientes del negocio). Mientras se lee no hay nada que medir y la pantalla
     refresca cada pocos segundos: ahí no se valida. Si no se puede medir, la
     pantalla sigue, solo que sin la cifra del plan (`espacio` null). */
  let espacio = null
  let excedePlan = false
  if (ESTADOS_EDITABLES.includes(sol.estado)) {
    try {
      const v = await validarCartera({ organizationId: sol.organizationId, plan: org?.plan, filas: pendientes.map(limpiarFila) })
      espacio = v.resumen.espacioDisponible
      excedePlan = v.resumen.excedePlan === true
    } catch (e) {
      console.error('[carga-asesor] espacio del plan:', e?.message)
    }
  }

  return {
    filas: filasParaLote(pendientes),
    base: baseDesdeNegocio(org),
    problemas: problemasPorArchivo(archivosDe(sol)),
    creadas: Object.keys(creadasDe(sol)),
    espacio,
    excedePlan,
    errorLectura: sol.errorLectura ?? null,
    bloqueada: sol.estado !== 'en_revision',
  }
}

export async function GET(request) {
  const { session, error } = await sesionDueno()
  if (error) return error
  /* `?solo=estado`: la pregunta que hace «Crear» antes de cada tanda (¿sigue la
     carga conmigo?). Va cada tres filas, así que no arma la revisión ni valida
     la cartera entera. */
  let soloEstado = false
  try { soloEstado = new URL(request?.url ?? '', 'http://x').searchParams.get('solo') === 'estado' } catch { /* sin URL: la de siempre */ }
  const sol = await prisma.solicitudCarga.findFirst({
    where: { organizationId: session.user.organizationId, createdAt: { gte: new Date(Date.now() - 60 * 86400000) } },
    orderBy: { createdAt: 'desc' },
  })
  const revision = !soloEstado && sol && CON_REVISION.includes(sol.estado) ? await revisionDe(sol) : null
  return Response.json({ solicitud: vista(sol), maxArchivos: MAX_ARCHIVOS, revision })
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
