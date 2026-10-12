// app/api/prestamos/[id]/cuota-que-toca/route.js — la cuota que toca cobrar ahora.
//
// La pide la hoja de pago cuando la abre una pantalla que no la trae (Clientes,
// Préstamos, el cobro por QR): así la hoja propone y compara contra la MISMA
// cifra que guarda el servidor al cobrar. Ver `calcularCuotaQueToca` en
// lib/calculos.js y el soporte del 12 oct 2026.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularCuotaQueToca } from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

export async function GET(_req, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  const { id } = await params
  const organizationId = session.user.organizationId
  const p = await prisma.prestamo.findFirst({
    where: { id, organizationId },
    include: {
      cliente: { select: { rutaId: true, diasSinCobro: true, ruta: { select: { diasSinCobro: true } } } },
      pagos: { select: { id: true, montoPagado: true, fechaPago: true, tipo: true } },
      cuotasAmortizacion: { orderBy: { numeroPeriodo: 'asc' } },
      devengos: { select: { periodo: true, interes: true, capitalBase: true }, orderBy: { periodo: 'asc' } },
    },
  })
  // El cobrador solo ve los de su ruta, como en la ficha.
  if (!p || (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(p.cliente?.rutaId))) {
    return Response.json({ error: 'Préstamo no encontrado' }, { status: 404 })
  }
  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])
  const cuotaQueToca = calcularCuotaQueToca(p, obtenerDiasSinCobro(p.cliente, p.cliente?.ruta, org, p), festivos)
  return Response.json({ cuotaQueToca })
}
