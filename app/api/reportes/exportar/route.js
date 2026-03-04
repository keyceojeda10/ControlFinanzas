// app/api/reportes/exportar/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import * as XLSX            from 'xlsx'

function headerRow(titulo, desde, hasta) {
  return [
    [`Control Finanzas — ${titulo}`],
    [`Período: ${desde} al ${hasta}`],
    [`Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
  ]
}

function setCurrency(ws, col, fromRow, toRow) {
  for (let r = fromRow; r <= toRow; r++) {
    const ref = `${col}${r}`
    if (!ws[ref]) continue
    ws[ref].z = '"$"#,##0'
    ws[ref].t = 'n'
  }
}

export async function GET(req) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo owners' }, { status: 403 })
  if (session.user.plan !== 'professional') return NextResponse.json({ error: 'Plan professional requerido' }, { status: 403 })

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const tipo  = searchParams.get('tipo')  ?? 'clientes' // clientes | prestamos | pagos | cobradores
  const desde = searchParams.get('desde') ?? new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  const hasta = searchParams.get('hasta') ?? new Date().toISOString().slice(0, 10)

  const fechaDesde = new Date(desde)
  const fechaHasta = new Date(hasta + 'T23:59:59')

  let wb = XLSX.utils.book_new()
  let filename = `control-finanzas-${tipo}-${desde}.xlsx`

  // ── CLIENTES ──────────────────────────────────────────────────
  if (tipo === 'clientes') {
    const rows = await prisma.cliente.findMany({
      where: { organizationId: orgId },
      include: { ruta: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    })

    const header = ['Nombre', 'Cédula', 'Teléfono', 'Dirección', 'Ruta', 'Estado', 'Activo']
    const data = [
      ...headerRow('Clientes', desde, hasta),
      header,
      ...rows.map((c) => [c.nombre, c.cedula, c.telefono, c.direccion, c.ruta?.nombre ?? '', c.estado, c.activo ? 'Sí' : 'No']),
    ]
    const ws = XLSX.utils.aoa_to_sheet(data)
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  }

  // ── PRÉSTAMOS ─────────────────────────────────────────────────
  else if (tipo === 'prestamos') {
    const rows = await prisma.prestamo.findMany({
      where: { organizationId: orgId },
      include: {
        cliente: { select: { nombre: true } },
        pagos:   { select: { montoPagado: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    })

    const header = ['Cliente', 'Monto Prestado', 'Total a Pagar', 'Cuota Diaria', 'Tasa %', 'Días', 'Inicio', 'Vence', 'Estado', 'Pagado', 'Saldo']
    const dataRows = rows.map((p) => {
      const pagado = p.pagos.reduce((a, pg) => a + pg.montoPagado, 0)
      const saldo  = Math.max(0, p.totalAPagar - pagado)
      return [
        p.cliente.nombre,
        p.montoPrestado,
        p.totalAPagar,
        p.cuotaDiaria,
        p.tasaInteres,
        p.diasPlazo,
        new Date(p.fechaInicio).toLocaleDateString('es-CO'),
        new Date(p.fechaFin).toLocaleDateString('es-CO'),
        p.estado,
        pagado,
        saldo,
      ]
    })

    const data = [...headerRow('Préstamos', desde, hasta), header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Currency columns: B, C, D, J, K (montoPrestado, totalAPagar, cuotaDiaria, pagado, saldo)
    const startRow = 6
    ;['B', 'C', 'D', 'J', 'K'].forEach((col) => setCurrency(ws, col, startRow, startRow + dataRows.length - 1))

    XLSX.utils.book_append_sheet(wb, ws, 'Préstamos')
  }

  // ── PAGOS ─────────────────────────────────────────────────────
  else if (tipo === 'pagos') {
    const rows = await prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId },
        fechaPago: { gte: fechaDesde, lte: fechaHasta },
      },
      include: {
        prestamo: { select: { cliente: { select: { nombre: true } } } },
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fechaPago: 'desc' },
    })

    const header = ['Fecha', 'Cliente', 'Cobrador', 'Monto']
    const dataRows = rows.map((p) => [
      new Date(p.fechaPago).toLocaleDateString('es-CO'),
      p.prestamo.cliente.nombre,
      p.cobrador?.nombre ?? '',
      p.montoPagado,
    ])

    const data = [...headerRow('Pagos', desde, hasta), header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const startRow = 6
    setCurrency(ws, 'D', startRow, startRow + dataRows.length - 1)
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos')
  }

  // ── COBRADORES ────────────────────────────────────────────────
  else if (tipo === 'cobradores') {
    const rows = await prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador' },
      include: {
        ruta: { select: { nombre: true } },
        cierresCaja: {
          where: { fecha: { gte: fechaDesde, lte: fechaHasta } },
          select: { totalRecogido: true, totalEsperado: true },
        },
      },
    })

    const header = ['Cobrador', 'Ruta', 'Días Trabajados', 'Total Esperado', 'Total Recogido', 'Diferencia', 'Eficiencia %']
    const dataRows = rows.map((c) => {
      const esperado  = c.cierresCaja.reduce((a, ci) => a + ci.totalEsperado, 0)
      const recogido  = c.cierresCaja.reduce((a, ci) => a + ci.totalRecogido, 0)
      const eficiencia = esperado > 0 ? Math.round((recogido / esperado) * 100) : 0
      return [c.nombre, c.ruta?.nombre ?? '', c.cierresCaja.length, esperado, recogido, recogido - esperado, eficiencia]
    })

    const data = [...headerRow('Cobradores', desde, hasta), header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const startRow = 6
    ;['D', 'E', 'F'].forEach((col) => setCurrency(ws, col, startRow, startRow + dataRows.length - 1))
    XLSX.utils.book_append_sheet(wb, ws, 'Cobradores')
  }

  const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
