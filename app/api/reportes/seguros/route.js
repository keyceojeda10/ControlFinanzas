// app/api/reportes/seguros/route.js
// Seguros cobrados POR RUTA. El seguro se genera al CREAR un prestamo con seguro,
// asi que se cuenta por fecha de creacion del prestamo. Filtro: dia/semana/mes/todo.

import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { exigeNivelReportes } from '@/lib/plan-servidor'

function rangoFecha(periodo) {
  // Fechas en hora Colombia (UTC-5) -> convertir a UTC para el query
  const ahora = new Date(Date.now() - 5 * 3600 * 1000)
  const hoy0 = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate(), 5, 0, 0))
  if (periodo === 'dia') return { gte: hoy0 }
  if (periodo === 'semana') {
    const d = new Date(hoy0); d.setUTCDate(d.getUTCDate() - 7); return { gte: d }
  }
  if (periodo === 'mes') {
    const d = new Date(hoy0); d.setUTCDate(d.getUTCDate() - 30); return { gte: d }
  }
  return null // 'todo' -> sin filtro
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  /* El plan del JWT no se refresca sin volver a entrar: quien acaba de
     pagar seguia viendo que su plan no alcanza. `exigeNivelReportes`
     usa el token como atajo y solo pregunta a la base cuando va a
     decir que no. Ver lib/plan-servidor.js. */
  const veto = await exigeNivelReportes(session, 2)
  if (veto) return veto

  const orgId = session.user.organizationId
  const { searchParams } = new URL(request.url)
  const periodo = searchParams.get('periodo') || 'mes' // dia|semana|mes|todo
  const rango = rangoFecha(periodo)

  const wherePrestamo = {
    seguro: true,
    montoSeguro: { gt: 0 },
    esClavo: false,
    ...(rango ? { createdAt: rango } : {}),
  }

  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      nombre: true,
      cobrador: { select: { nombre: true } },
      clientes: {
        select: {
          prestamos: {
            where: wherePrestamo,
            select: { montoSeguro: true },
          },
        },
      },
    },
    orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
  })

  let totalGeneral = 0
  let cantGeneral = 0
  const items = rutas.map(r => {
    let totalSeguro = 0
    let cant = 0
    for (const c of r.clientes) {
      for (const p of c.prestamos) {
        totalSeguro += p.montoSeguro || 0
        cant++
      }
    }
    totalGeneral += totalSeguro
    cantGeneral += cant
    return {
      rutaId: r.id,
      ruta: r.nombre,
      cobrador: r.cobrador?.nombre || 'Sin cobrador',
      cantPrestamosConSeguro: cant,
      totalSeguro: Math.round(totalSeguro),
    }
  }).filter(x => x.cantPrestamosConSeguro > 0)
    .sort((a, b) => b.totalSeguro - a.totalSeguro)

  // Prestamos sin ruta (cliente sin rutaId) con seguro
  const sinRuta = await prisma.prestamo.aggregate({
    where: { organizationId: orgId, ...wherePrestamo, cliente: { rutaId: null } },
    _sum: { montoSeguro: true },
    _count: true,
  })
  if (sinRuta._count > 0) {
    items.push({
      rutaId: null, ruta: 'Sin ruta', cobrador: '—',
      cantPrestamosConSeguro: sinRuta._count,
      totalSeguro: Math.round(sinRuta._sum.montoSeguro || 0),
    })
    totalGeneral += sinRuta._sum.montoSeguro || 0
    cantGeneral += sinRuta._count
  }

  return NextResponse.json({
    periodo,
    items,
    totalGeneral: Math.round(totalGeneral),
    cantGeneral,
  })
}
