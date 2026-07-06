import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { nivelReportes }    from '@/lib/planes'

const DIAS_PERIODO = { diario: 1, semanal: 7, quincenal: 15, mensual: 30 }

function cuotasEnMes(prestamo, year, month) {
  const mesInicio = new Date(year, month, 1)
  const mesFin    = new Date(year, month + 1, 0, 23, 59, 59)

  if (prestamo.cuotasAmortizacion?.length > 0) {
    let total = 0
    let cuotas = 0
    for (const ca of prestamo.cuotasAmortizacion) {
      const fecha = new Date(ca.fechaEsperada)
      if (fecha >= mesInicio && fecha <= mesFin) {
        total += ca.cuotaTotal - (ca.pagado || 0)
        if (ca.cuotaTotal - (ca.pagado || 0) > 0) cuotas++
      }
    }
    return { total: Math.max(0, total), cuotas }
  }

  const inicio = new Date(prestamo.fechaInicio)
  const fin    = new Date(prestamo.fechaFin)
  if (fin < mesInicio || inicio > mesFin) return { total: 0, cuotas: 0 }

  const freq = prestamo.frecuencia || 'diario'
  const cuota = prestamo.cuotaDiaria || 0
  const diasP = DIAS_PERIODO[freq] || 1

  if (freq === 'mensual') {
    const diaAncla = prestamo.diaCobroMes || inicio.getDate()
    const fechaCobro = new Date(year, month, Math.min(diaAncla, mesFin.getDate()))
    if (fechaCobro >= inicio && fechaCobro <= fin && fechaCobro >= mesInicio && fechaCobro <= mesFin) {
      return { total: cuota, cuotas: 1 }
    }
    return { total: 0, cuotas: 0 }
  }

  let count = 0
  const rangeStart = inicio > mesInicio ? inicio : mesInicio
  const rangeEnd   = fin < mesFin ? fin : mesFin
  let cursor = new Date(inicio)

  if (freq === 'semanal' || freq === 'quincenal') {
    while (cursor <= rangeEnd) {
      if (cursor >= rangeStart) count++
      cursor.setDate(cursor.getDate() + diasP)
    }
  } else {
    const diasTotales = Math.floor((rangeEnd - rangeStart) / (1000 * 60 * 60 * 24)) + 1
    count = diasTotales
  }

  return { total: count * cuota, cuotas: count }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  if (nivelReportes(session.user.plan) < 2) return NextResponse.json({ error: 'Plan insuficiente' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const year  = Number(searchParams.get('year'))  || new Date().getFullYear()
  const month = Number(searchParams.get('month')) ?? new Date().getMonth()
  const monthIdx = month >= 1 && month <= 12 ? month - 1 : new Date().getMonth()

  const mesInicio = new Date(year, monthIdx, 1)
  const mesFin    = new Date(year, monthIdx + 1, 0, 23, 59, 59)

  const rutas = await prisma.ruta.findMany({
    where: { organizationId: orgId },
    select: {
      id: true,
      nombre: true,
      cobrador: { select: { nombre: true } },
      clientes: {
        where: { estado: 'activo' },
        select: {
          id: true,
          nombre: true,
          cedula: true,
          telefono: true,
          prestamos: {
            where: {
              estado: 'activo',
              esClavo: false,
              fechaInicio: { lte: mesFin },
              fechaFin: { gte: mesInicio },
            },
            select: {
              id: true,
              cuotaDiaria: true,
              totalAPagar: true,
              totalPagado: true,
              frecuencia: true,
              fechaInicio: true,
              fechaFin: true,
              diaCobroMes: true,
              cuotasAmortizacion: {
                select: {
                  numeroPeriodo: true,
                  cuotaTotal: true,
                  pagado: true,
                  fechaEsperada: true,
                },
              },
            },
          },
        },
      },
    },
    orderBy: { nombre: 'asc' },
  })

  const resultado = []
  let granTotal = 0
  let totalClientes = 0

  for (const ruta of rutas) {
    const clientesRuta = []

    for (const cliente of ruta.clientes) {
      let totalMesCliente = 0
      let cuotasMes = 0

      for (const p of cliente.prestamos) {
        const { total, cuotas } = cuotasEnMes(p, year, monthIdx)
        totalMesCliente += total
        cuotasMes += cuotas
      }

      if (totalMesCliente > 0) {
        const saldoTotal = cliente.prestamos.reduce((a, p) => a + Math.max(0, p.totalAPagar - (p.totalPagado || 0)), 0)
        clientesRuta.push({
          id: cliente.id,
          nombre: cliente.nombre,
          cedula: cliente.cedula,
          telefono: cliente.telefono,
          prestamosActivos: cliente.prestamos.length,
          cuotasMes,
          totalMes: Math.round(totalMesCliente),
          saldoPendiente: Math.round(saldoTotal),
        })
        granTotal += totalMesCliente
        totalClientes++
      }
    }

    if (clientesRuta.length > 0) {
      resultado.push({
        rutaId: ruta.id,
        ruta: ruta.nombre,
        cobrador: ruta.cobrador?.nombre ?? 'Sin cobrador',
        clientes: clientesRuta,
        totalRuta: Math.round(clientesRuta.reduce((a, c) => a + c.totalMes, 0)),
      })
    }
  }

  const meses = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

  return NextResponse.json({
    year,
    month: monthIdx + 1,
    monthLabel: `${meses[monthIdx]} ${year}`,
    totalClientes,
    granTotal: Math.round(granTotal),
    rutas: resultado,
  })
}
