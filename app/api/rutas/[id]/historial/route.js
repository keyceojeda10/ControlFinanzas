// app/api/rutas/[id]/historial/route.js
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { getUtcOffset } from '@/lib/i18n'
import { tocaCobrarEn, SELECT_PRESTAMO } from '@/lib/dinero/esperado'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { esAbonoPrevio } from '@/lib/dinero/abono-previo'

export async function GET(request, { params }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { id } = await params
  const { id: userId, organizationId, rol } = session.user

  if (rol === 'cobrador') {
    const acceso = await prisma.ruta.findFirst({ where: { id, organizationId, cobradorId: userId }, select: { id: true } })
    if (!acceso) return Response.json({ error: 'No tienes acceso' }, { status: 403 })
  }

  const ruta = await prisma.ruta.findFirst({
    where: { id, organizationId },
    select: { id: true, cobradorId: true, diasSinCobro: true },
  })
  if (!ruta) return Response.json({ error: 'Ruta no encontrada' }, { status: 404 })

  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])

  /* ⚠ TODOS SUS PRÉSTAMOS, NO SOLO LOS ACTIVOS (DETALLES-RUTAS #64). Con solo
     los activos, el pago con que Jhon Fredy cerró su préstamo sumaba al total
     del día pero él no salía ni en «pagaron» ni en «sin pagar»: el préstamo ya
     no estaba en el mapa. Los anulados y las solicitudes sin aprobar no:
     ahí no hubo cobro. */
  const clientes = await prisma.cliente.findMany({
    where: { rutaId: id, organizationId },
    select: {
      id: true,
      nombre: true,
      diasSinCobro: true,
      prestamos: {
        where: { estado: { notIn: ['cancelado', 'pendiente_aprobacion'] } },
        select: { ...SELECT_PRESTAMO, estado: true, esClavo: true },
      },
    },
  })
  const clienteIds = clientes.map(c => c.id)
  const clienteMap = Object.fromEntries(clientes.map(c => [c.id, { nombre: c.nombre }]))
  const prestamoClienteMap = {}
  for (const c of clientes) {
    for (const p of c.prestamos) {
      prestamoClienteMap[p.id] = c.id
    }
  }
  // Los préstamos vivos de cada cliente, para saber a quién le tocaba cobro.
  const vivos = clientes.map((c) => ({
    c,
    prestamos: c.prestamos.filter((p) => p.estado === 'activo' && !p.esClavo),
  })).filter((x) => x.prestamos.length > 0)

  if (clienteIds.length === 0) {
    return Response.json({ dias: [] })
  }

  // Rango por query params (?desde=YYYY-MM-DD&hasta=YYYY-MM-DD), default últimos 90 días
  const { searchParams } = new URL(request.url)
  const desdeParam = searchParams.get('desde')
  const hastaParam = searchParams.get('hasta')

  let desde, hasta
  if (desdeParam) {
    desde = new Date(`${desdeParam}T05:00:00.000Z`) // medianoche Colombia
  } else {
    desde = new Date()
    desde.setDate(desde.getDate() - 90)
  }
  if (hastaParam) {
    hasta = new Date(`${hastaParam}T05:00:00.000Z`)
    hasta.setUTCDate(hasta.getUTCDate() + 1) // incluir todo el día seleccionado
  }

  const pagos = await prisma.pago.findMany({
    where: {
      organizationId,
      prestamo: { clienteId: { in: clienteIds } },
      fechaPago: hasta ? { gte: desde, lt: hasta } : { gte: desde },
      tipo: { notIn: ['recargo', 'descuento'] },
    },
    select: {
      montoPagado: true,
      fechaPago: true,
      tipo: true,
      prestamoId: true,
      nota: true,
    },
    orderBy: { fechaPago: 'desc' },
  })

  // Agrupar por día Colombia
  const country = session.user.country ?? 'co'
  const diaDe = (fecha) => new Date(fecha.getTime() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000).toISOString().slice(0, 10)
  const porDia = {}
  for (const p of pagos) {
    /* El abono previo de un préstamo migrado no se cobró en la ruta (#64): se
       fecha en el inicio del préstamo y salía «Jue, 10 de sept · $228.000 ·
       0 pagaron · 11 sin pagar», un día de cobros que nunca existió. */
    if (esAbonoPrevio(p)) continue
    const key = diaDe(p.fechaPago)
    if (!porDia[key]) porDia[key] = { cobrado: 0, clientes: {} }
    porDia[key].cobrado += p.montoPagado

    const clienteId = prestamoClienteMap[p.prestamoId]
    if (clienteId) {
      if (!porDia[key].clientes[clienteId]) {
        porDia[key].clientes[clienteId] = { monto: 0, tipo: p.tipo }
      }
      porDia[key].clientes[clienteId].monto += p.montoPagado
    }
  }

  const dias = Object.keys(porDia)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 60)
    .map(fecha => {
      const dia = porDia[fecha]
      // Lista de quién pagó
      const pagaron = Object.entries(dia.clientes).map(([cId, info]) => ({
        nombre: clienteMap[cId]?.nombre || 'Cliente',
        monto: Math.round(info.monto),
        tipo: info.tipo,
      })).sort((a, b) => b.monto - a.monto)

      /* «Sin pagar» = a quien le TOCABA cuota ese día y no pagó nada (#64).
         Antes era todo cliente con préstamo activo, le tocara o no: «5 pagaron ·
         6 sin pagar» con la ruta diciendo «5 de 8». Para los días pasados se
         mira el calendario de sus préstamos de hoy (cuánto llevaba cubierto ese
         día no se guarda); la fila de HOY la corrige la pantalla con lo que dice
         la ruta arriba (`hoy`), que sí sabe quién debe hoy. */
      const noPagaron = vivos
        .filter(({ c, prestamos }) => !dia.clientes[c.id] && prestamos.some((p) =>
          tocaCobrarEn(p, fecha, obtenerDiasSinCobro(c, ruta, org, p), festivos)))
        .map(({ c }) => clienteMap[c.id].nombre)

      return {
        fecha,
        cobrado: Math.round(dia.cobrado),
        pagaron,
        noPagaron,
        totalClientes: vivos.length,
      }
    })

  return Response.json({ dias, hoy: diaDe(new Date()) })
}
