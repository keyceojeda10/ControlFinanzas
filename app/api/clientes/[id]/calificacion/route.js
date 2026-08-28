import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { NIVELES } from '@/lib/calificacion'

/* CORREGIR A MANO CÓMO SE CALIFICA A UN CLIENTE.
 *
 * El nivel se CALCULA del historial y no hace falta tocarlo casi nunca. Esto es
 * para la excepción que pidió el prestamista: alguien a quien conoce de antes,
 * o alguien cuyo retraso estaba acordado y no debería contar en su contra.
 *
 * ⚠ ENDPOINT PROPIO, Y SOLO PARA EL DUEÑO. El `PATCH` general de cliente lo
 * puede usar un cobrador con `puedeEditarClientes`, y aquí eso no vale: «como
 * para que el administrador solamente pueda hacer eso». Reusar aquel habría
 * dejado calificar al cobrador al que la marca pretende avisar.
 *
 * ⚠ SE GUARDA QUIÉN Y CUÁNDO. Sin eso habría dos verdades sobre lo mismo —la
 * calculada y la puesta a mano— sin forma de saber cuál mandó ni desde cuándo,
 * que es exactamente de donde salen las cifras que no cuadran en este repo.
 */
export async function PUT(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador puede calificar clientes' }, { status: 403 })
  }

  const { id } = await params
  const { nivel } = await request.json().catch(() => ({}))

  /* `null` devuelve el mando al cálculo automático. Es la salida de «me
     equivoqué al marcarlo», y tiene que existir: sin ella, una marca puesta por
     error se queda para siempre. */
  if (nivel != null && !NIVELES.includes(nivel)) {
    return Response.json({ error: 'Calificación no válida' }, { status: 400 })
  }

  const cliente = await prisma.cliente.findFirst({
    where: { id, organizationId: session.user.organizationId },
    select: { id: true, nombre: true, calificacionManual: true },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  await prisma.cliente.update({
    where: { id },
    data: {
      calificacionManual: nivel ?? null,
      calificacionPorId: nivel ? session.user.id : null,
      calificacionAt: nivel ? new Date() : null,
    },
  })

  logActividad({
    session,
    accion: 'calificar_cliente',
    entidadTipo: 'cliente',
    entidadId: id,
    detalle: nivel
      ? `Calificó a ${cliente.nombre} como «${nivel}»`
      : `Quitó la calificación a mano de ${cliente.nombre}`,
  })

  return Response.json({ ok: true, nivel: nivel ?? null })
}
