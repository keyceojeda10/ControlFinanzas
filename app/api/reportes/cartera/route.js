// app/api/reportes/cartera/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { nivelReportes }   from '@/lib/planes'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  if (nivelReportes(session.user.plan) < 2) return NextResponse.json({ error: 'Plan insuficiente' }, { status: 403 })

  const orgId = session.user.organizationId

  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    include: {
      cobrador: { select: { nombre: true } },
      clientes: {
        where: { estado: 'activo' },
        include: {
          prestamos: {
            where: { estado: 'activo' },
            select: {
              montoPrestado: true,
              totalAPagar: true,
              cuotaDiaria: true,
              pagos: { select: { montoPagado: true, tipo: true } },
            },
          },
        },
      },
    },
  })

  const resultado = rutas.map((r) => {
    let capitalActivo = 0
    let saldoPendiente = 0
    let cuotaDiariaTotal = 0
    const clientesActivos = r.clientes.length

    for (const cliente of r.clientes) {
      for (const p of cliente.prestamos) {
        const pagado = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
        const saldo  = Math.max(0, p.totalAPagar - pagado)
        capitalActivo   += p.montoPrestado
        saldoPendiente  += saldo
        cuotaDiariaTotal += p.cuotaDiaria
      }
    }

    return {
      id:           r.id,
      ruta:         r.nombre,
      cobrador:     r.cobrador?.nombre ?? 'Sin cobrador',
      clientes:     clientesActivos,
      capitalActivo,
      saldoPendiente,
      cuotaDiariaTotal,
    }
  })

  return NextResponse.json(resultado)
}
