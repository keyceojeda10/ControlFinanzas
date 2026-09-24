// La «Planilla Recaudador» de Crossbox, subida en PDF: devuelve sus filas para la
// revisión de siempre. No guarda nada. Ver lib/importar/planilla-crossbox.js.
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { paginasDePdf, MAX_BYTES_PDF, MENSAJES_PDF } from '@/lib/importar/pdf-texto'
import { leerPlanillaCrossbox } from '@/lib/importar/planilla-crossbox'

export const runtime = 'nodejs'

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador puede importar datos' }, { status: 403 })

  const form = await request.formData().catch(() => null)
  const archivo = form?.get('archivo')
  if (!archivo || typeof archivo.arrayBuffer !== 'function') return Response.json({ error: MENSAJES_PDF.falta }, { status: 400 })
  if (archivo.size > MAX_BYTES_PDF) return Response.json({ error: MENSAJES_PDF.pesado }, { status: 400 })

  const buffer = Buffer.from(await archivo.arrayBuffer())
  if (buffer.subarray(0, 5).toString('latin1') !== '%PDF-') return Response.json({ error: MENSAJES_PDF.noEsPdf }, { status: 400 })

  let leido
  try {
    leido = await paginasDePdf(buffer)
  } catch (err) {
    console.error('[carga-masiva/leer-pdf]', err?.message)
    return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  }
  if (leido.error) return Response.json({ error: MENSAJES_PDF.paginas(leido.numPages) }, { status: 400 })

  let planilla
  try {
    planilla = leerPlanillaCrossbox(leido.paginas)
  } catch (err) {
    console.error('[carga-masiva/leer-pdf]', err?.message)
    return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  }
  if (!planilla || planilla.filas.length === 0) return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  // Sin «Fecha:» legible no hay fecha de corte, y sin ella no hay con qué
  // deducir tasa, cuotas ni frecuencia de NINGUNA fila (ver deducir-condiciones.js):
  // mejor no seguir que dejar que cada fila reviente después, ya en la revisión.
  if (!planilla.fechaCorte) return Response.json({ error: MENSAJES_PDF.desconocido }, { status: 422 })
  // La cifra de control: si las filas no suman lo mismo que «Totales», falta algo.
  if (!planilla.cuadraConTotales) return Response.json({ error: MENSAJES_PDF.incompleto }, { status: 422 })

  return Response.json({ planilla })
}
