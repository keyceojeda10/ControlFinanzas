// app/api/reportes/cartera/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId

  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      nombre: true,
      cobrador: { select: { nombre: true } },
      _count: { select: { clientes: { where: { activo: true } } } },
      clientes: {
        where: { activo: true },
        select: {
          prestamos: {
            where: { estado: 'activo' },
            select: {
              montoPrestado: true,
              totalAPagar: true,
              cuotaDiaria: true,
              pagos: { select: { montoPagado: true } },
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

    for (const cliente of r.clientes) {
      for (const p of cliente.prestamos) {
        const pagado = p.pagos.reduce((a, pg) => a + pg.montoPagado, 0)
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
      clientes:     r._count.clientes,
      capitalActivo,
      saldoPendiente,
      cuotaDiariaTotal,
    }
  })

  return NextResponse.json(resultado)
}
