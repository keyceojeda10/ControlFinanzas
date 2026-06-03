// app/api/clavos/route.js
// Contabilidad APARTE de las tarjetas clavo (prestamos malos/incobrables).
// Lista los prestamos marcados esClavo=true con sus totales, sin tocar los
// numeros normales del negocio.

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calcularSaldoPendiente } from '@/lib/calculos'

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const { organizationId, rol, rutaIds = [] } = session.user

  const where = { organizationId, esClavo: true }
  // Cobrador solo ve clavos de sus rutas
  if (rol === 'cobrador') {
    where.cliente = { rutaId: { in: rutaIds } }
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    orderBy: { clavoAt: 'desc' },
    include: {
      cliente: { select: { id: true, nombre: true, rutaId: true, ruta: { select: { nombre: true } } } },
      pagos: { select: { montoPagado: true, tipo: true } },
    },
  })

  let capitalEnClavos = 0   // capital prestado atrapado en clavos
  let saldoEnClavos = 0     // lo que aun deben (saldo pendiente)
  let recuperado = 0        // lo que se ha recuperado de los clavos (pagos reales)

  const items = prestamos.map(p => {
    const pagosReales = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo))
    const pagado = pagosReales.reduce((a, pg) => a + (pg.montoPagado || 0), 0)
    const saldo = calcularSaldoPendiente(p)
    capitalEnClavos += p.montoPrestado || 0
    saldoEnClavos += saldo
    recuperado += pagado
    return {
      id: p.id,
      cliente: p.cliente?.nombre || 'Sin nombre',
      clienteId: p.cliente?.id,
      ruta: p.cliente?.ruta?.nombre || 'Sin ruta',
      montoPrestado: p.montoPrestado,
      saldoPendiente: Math.round(saldo),
      recuperado: Math.round(pagado),
      clavoPerdida: p.clavoPerdida,
      clavoAt: p.clavoAt,
    }
  })

  return Response.json({
    items,
    total: items.length,
    capitalEnClavos: Math.round(capitalEnClavos),
    saldoEnClavos: Math.round(saldoEnClavos),
    recuperado: Math.round(recuperado),
  })
}
