/**
 * GET /api/prestamos/[id]/corregir
 *
 * ¿Este préstamo se puede corregir en vez de borrarlo y crearlo de nuevo? Y,
 * si se puede, con qué datos se llena el formulario. La regla vive en
 * `lib/dinero/corregir-prestamo.js`; el alta (`POST /api/prestamos` con
 * `corrigeA`) la vuelve a preguntar al guardar.
 */
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { evaluarCorreccion, cobrosDe } from '@/lib/dinero/corregir-prestamo'

export const dynamic = 'force-dynamic'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ puede: false, motivo: 'Solo el dueño puede corregir un préstamo.' })
  }
  const { id } = await params
  const { organizationId } = session.user
  const r = await evaluarCorreccion(prisma, { id, organizationId, pais: session.user.country || 'co' })
  if (!r.puede) return Response.json({ puede: false, motivo: r.motivo })

  const p = await prisma.prestamo.findFirst({
    where: { id, organizationId },
    select: {
      id: true, clienteId: true, montoPrestado: true, tasaInteres: true, diasPlazo: true, fechaInicio: true,
      frecuencia: true, modoInteres: true, cuotaDiaria: true, sinPlazo: true, interesPorMes: true,
      interesMesCompleto: true, interesAdelantado: true, diaCobroSemana: true, diaCobroMes: true,
      diaCobroMes2: true, nombreProducto: true, seguro: true, montoSeguro: true, socioId: true, nota: true,
      cliente: { select: { nombre: true } },
      pagos: { select: { tipo: true, montoPagado: true, fechaPago: true } },
    },
  })
  /* Lo cobrado partido en interés y capital, para el abierto: el formulario lo
     pregunta así («Ambos»). La fecha del capital, la del último abono a capital. */
  const cobros = cobrosDe(p)
  const deInteres = Math.round(cobros.filter((x) => x.tipo === 'intereses').reduce((t, x) => t + Number(x.montoPagado || 0), 0))
  const ultimoCapital = cobros.filter((x) => x.tipo === 'capital').map((x) => x.fechaPago).sort().pop() ?? null

  return Response.json({
    puede: true,
    cobrado: r.cobrado,
    salio: r.salio,
    desembolsoEl: r.desembolsoEl,
    deInteres,
    fechaAbonoCapital: ultimoCapital ? new Date(ultimoCapital).toISOString().slice(0, 10) : null,
    prestamo: {
      ...p,
      fechaInicio: new Date(p.fechaInicio).toISOString().slice(0, 10),
      pagos: undefined,
    },
  })
}
