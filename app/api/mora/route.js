// app/api/mora/route.js - API para obtener clientes en mora con días de mora

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularDiasMora, calcularSaldoPendiente } from '@/lib/calculos'

// GET /api/mora - Devuelve clientes en mora agrupados por días de mora
export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaId } = session.user

  // Cobrador sin ruta asignada no ve nada (previene fuga multi-tenant)
  if (rol === 'cobrador' && !rutaId) {
    return Response.json({ total: 0, agrupado: { mora1a7: [], mora8a15: [], mora16a30: [], mora31plus: [] }, lista: [] })
  }

  // Filtro para cobradores
  const wherePrestamo = {
    organizationId,
    estado: 'activo',
    ...(rol === 'cobrador' && { cliente: { rutaId } }),
  }

  // Obtener préstamos activos vencidos
  const prestamos = await prisma.prestamo.findMany({
    where: wherePrestamo,
    include: {
      cliente: {
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          rutaId: true,
          ruta: { select: { nombre: true } },
        },
      },
      pagos: {
        select: { id: true, montoPagado: true, fechaPago: true, tipo: true },
      },
    },
  })

  // Calcular mora para cada préstamo
  const clientesEnMora = prestamos
    .map((p) => {
      const diasMora = calcularDiasMora(p)
      if (diasMora <= 0) return null
      return {
        prestamoId: p.id,
        cliente: p.cliente,
        montoPrestado: p.montoPrestado,
        totalAPagar: p.totalAPagar,
        cuotaDiaria: p.cuotaDiaria,
        frecuencia: p.frecuencia,
        fechaFin: p.fechaFin,
        diasMora,
        saldoPendiente: calcularSaldoPendiente(p),
        totalPagado: p.pagos.filter(x => !['recargo', 'descuento'].includes(x.tipo)).reduce((a, x) => a + x.montoPagado, 0),
      }
    })
    .filter(Boolean)

  // Agrupar por rangos de mora
  const agrupado = {
    mora1a7: clientesEnMora.filter((c) => c.diasMora >= 1 && c.diasMora <= 7),
    mora8a15: clientesEnMora.filter((c) => c.diasMora >= 8 && c.diasMora <= 15),
    mora16a30: clientesEnMora.filter((c) => c.diasMora >= 16 && c.diasMora <= 30),
    mora31plus: clientesEnMora.filter((c) => c.diasMora > 30),
  }

  return Response.json({
    total: clientesEnMora.length,
    agrupado,
    lista: clientesEnMora.sort((a, b) => b.diasMora - a.diasMora),
  })
}
