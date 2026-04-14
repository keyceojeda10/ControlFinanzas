// app/api/reportes/cobradores/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const fechaDesde = desde ? new Date(desde) : new Date(new Date().setDate(1))
  const fechaHasta = hasta ? new Date(hasta + 'T23:59:59') : new Date()

  const cobradores = await prisma.user.findMany({
    where: { organizationId: orgId, rol: 'cobrador', activo: true },
    include: {
      rutas: {
        where: { activo: true },
        include: {
          clientes: { where: { estado: 'activo' }, select: { id: true } },
        },
      },
      cierresCaja: {
        where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
        select: {
          totalRecogido: true,
          totalEsperado: true,
          totalGastos: true,
          totalDesembolsado: true,
          saldoOperativo: true,
          saldoRealCaja: true,
        },
      },
    },
  })

  const resultado = cobradores.map((c) => {
    const ruta = c.rutas?.[0]
    const totalEsperado  = c.cierresCaja.reduce((a, ci) => a + ci.totalEsperado, 0)
    const totalRecogido  = c.cierresCaja.reduce((a, ci) => a + ci.totalRecogido, 0)
    const totalGastos = c.cierresCaja.reduce((a, ci) => a + (ci.totalGastos || 0), 0)
    const totalDesembolsado = c.cierresCaja.reduce((a, ci) => a + (ci.totalDesembolsado || 0), 0)
    const saldoOperativo = c.cierresCaja.reduce((a, ci) => a + (ci.saldoOperativo ?? (ci.totalRecogido - (ci.totalGastos || 0))), 0)
    const saldoRealCaja = c.cierresCaja.reduce((a, ci) => a + (ci.saldoRealCaja ?? ((ci.totalRecogido - (ci.totalGastos || 0)) - (ci.totalDesembolsado || 0))), 0)
    const diasTrabajados = c.cierresCaja.length
    const eficiencia     = totalEsperado > 0 ? Math.round((totalRecogido / totalEsperado) * 100) : 0
    const clientesCount  = ruta?.clientes?.length ?? 0

    return {
      id:           c.id,
      nombre:       c.nombre,
      ruta:         ruta?.nombre ?? 'Sin ruta',
      clientes:     clientesCount,
      totalEsperado,
      totalRecogido,
      totalGastos,
      totalDesembolsado,
      saldoOperativo,
      saldoRealCaja,
      diferencia:   totalRecogido - totalEsperado,
      diasTrabajados,
      eficiencia,
    }
  })

  return NextResponse.json(resultado)
}
