// app/api/pagos/export/route.js — Exportar pagos a CSV
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'

const escaparCSV = (val) => {
  if (val === null || val === undefined) return ''
  const s = String(val)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

const fmtFechaCO = (d) => {
  if (!d) return ''
  // Convertir a hora Colombia (UTC-5) y formatear ISO local
  const local = new Date(new Date(d).getTime() - 5 * 60 * 60 * 1000)
  return local.toISOString().replace('T', ' ').slice(0, 19)
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { rol, rutaId, organizationId, id: userId } = session.user
  const url = new URL(request.url)
  const desde = url.searchParams.get('desde')
  const hasta = url.searchParams.get('hasta')
  const cobradorId = url.searchParams.get('cobrador')
  const prestamoId = url.searchParams.get('prestamo')
  const clienteId = url.searchParams.get('cliente')

  const where = { organizationId }

  // Cobrador: solo pagos de su ruta
  if (rol === 'cobrador') {
    where.prestamo = { cliente: { rutaId } }
    where.cobradorId = userId
  } else if (cobradorId) {
    where.cobradorId = cobradorId
  }

  if (prestamoId) where.prestamoId = prestamoId
  if (clienteId) {
    where.prestamo = { ...(where.prestamo || {}), clienteId }
  }

  if (desde || hasta) {
    where.fechaPago = {}
    if (desde) {
      where.fechaPago.gte = new Date(`${desde}T00:00:00-05:00`)
    }
    if (hasta) {
      where.fechaPago.lte = new Date(`${hasta}T23:59:59-05:00`)
    }
  }

  const pagos = await prisma.pago.findMany({
    where,
    orderBy: { fechaPago: 'desc' },
    include: {
      cobrador: { select: { nombre: true } },
      prestamo: {
        select: {
          id: true,
          montoPrestado: true,
          cliente: { select: { nombre: true, telefono: true, ruta: { select: { nombre: true } } } },
        },
      },
    },
  })

  const header = [
    'Fecha',
    'Cliente',
    'Telefono',
    'Ruta',
    'Cobrador',
    'Tipo',
    'Monto',
    'Metodo',
    'Plataforma',
    'Nota',
    'PrestamoId',
    'MontoPrestamo',
  ].join(',')

  const filas = pagos.map((p) => [
    fmtFechaCO(p.fechaPago),
    escaparCSV(p.prestamo?.cliente?.nombre),
    escaparCSV(p.prestamo?.cliente?.telefono),
    escaparCSV(p.prestamo?.cliente?.ruta?.nombre),
    escaparCSV(p.cobrador?.nombre),
    escaparCSV(p.tipo),
    escaparCSV(p.montoPagado),
    escaparCSV(p.metodoPago),
    escaparCSV(p.plataforma),
    escaparCSV(p.nota),
    escaparCSV(p.prestamo?.id),
    escaparCSV(p.prestamo?.montoPrestado),
  ].join(','))

  const bom = '\uFEFF' // para que Excel detecte UTF-8
  const csv = bom + [header, ...filas].join('\r\n')

  const nombreArchivo = `pagos_${desde || 'inicio'}_${hasta || 'hoy'}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${nombreArchivo}"`,
      'Cache-Control': 'no-store',
    },
  })
}
