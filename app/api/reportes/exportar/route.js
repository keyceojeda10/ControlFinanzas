// app/api/reportes/exportar/route.js
import { NextResponse }     from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import * as XLSX            from 'xlsx'
import { exigeNivelReportes } from '@/lib/plan-servidor'

// `desde`/`hasta` en null => la hoja NO esta filtrada por fecha y lo dice.
// Antes las hojas de Clientes y Prestamos escribian "Periodo: 2026-07-01 al
// 2026-07-22" cuando sus queries no filtran por fecha en absoluto: el dueño
// leia "julio" y estaba viendo toda su historia. Un dato que miente en la
// cabecera vale menos que ninguna cabecera.
function headerRow(titulo, desde, hasta) {
  return [
    [`Control Finanzas — ${titulo}`],
    [desde && hasta ? `Período: ${desde} al ${hasta}` : 'Todos los registros (sin filtro de fecha)'],
    [`Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
  ]
}

// Sin !cols, Excel abre con ~8 caracteres de ancho y "$123.456.789" no cabe:
// se ve #########. Es la version Excel de "se sale del cuadro" que reporto el
// usuario. La plantilla de carga masiva ya lo hacia bien.
function anchos(ws, widths) {
  ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
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
  if (session.user.rol !== 'owner') return NextResponse.json({ error: 'Solo el administrador' }, { status: 403 })
  /* El plan del JWT no se refresca sin volver a entrar: quien acaba de
     pagar seguia viendo que su plan no alcanza. `exigeNivelReportes`
     usa el token como atajo y solo pregunta a la base cuando va a
     decir que no. Ver lib/plan-servidor.js. */
  const veto = await exigeNivelReportes(session, 3)
  if (veto) return veto

  const orgId = session.user.organizationId
  const { searchParams } = new URL(req.url)
  const tipo  = searchParams.get('tipo')  ?? 'clientes' // clientes | prestamos | pagos | cobradores
  const desde = searchParams.get('desde') ?? new Date(new Date().setDate(1)).toISOString().slice(0, 10)
  const hasta = searchParams.get('hasta') ?? new Date().toISOString().slice(0, 10)

  // Rango en timezone Colombia (UTC-5). Sin esto, `new Date(desde)` interpreta
  // la cadena como UTC y trae pagos del dia anterior.
  const fechaDesde = new Date(desde + 'T00:00:00-05:00')
  const fechaHasta = new Date(hasta + 'T23:59:59.999-05:00')

  let wb = XLSX.utils.book_new()
  let filename = `control-finanzas-${tipo}-${desde}.xlsx`

  // ── CLIENTES ──────────────────────────────────────────────────
  if (tipo === 'clientes') {
    const rows = await prisma.cliente.findMany({
      where: { organizationId: orgId, estado: { notIn: ['eliminado'] } },
      include: { ruta: { select: { nombre: true } } },
      orderBy: { nombre: 'asc' },
    })

    const header = ['Nombre', 'Cédula', 'Teléfono', 'Dirección', 'Ruta', 'Estado']
    const data = [
      ...headerRow('Clientes', null, null),
      header,
      ...rows.map((c) => [c.nombre, c.cedula, c.telefono, c.direccion, c.ruta?.nombre ?? '', c.estado]),
    ]
    const ws = anchos(XLSX.utils.aoa_to_sheet(data), [26, 14, 14, 30, 18, 12])
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes')
  }

  // ── PRÉSTAMOS ─────────────────────────────────────────────────
  else if (tipo === 'prestamos') {
    const rows = await prisma.prestamo.findMany({
      where: { organizationId: orgId },
      include: {
        cliente: { select: { nombre: true } },
        pagos:   { select: { montoPagado: true, tipo: true } },
      },
      orderBy: { fechaInicio: 'desc' },
    })

    const header = ['Cliente', 'Monto Prestado', 'Total a Pagar', 'Cuota Diaria', 'Tasa %', 'Días', 'Inicio', 'Vence', 'Estado', 'Pagado', 'Saldo']
    const dataRows = rows.map((p) => {
      const pagado = p.pagos.filter(pg => !['recargo', 'descuento'].includes(pg.tipo)).reduce((a, pg) => a + pg.montoPagado, 0)
      const saldo  = Math.max(0, p.totalAPagar - pagado)
      return [
        p.cliente.nombre,
        p.montoPrestado,
        p.totalAPagar,
        p.cuotaDiaria,
        p.tasaInteres,
        p.diasPlazo,
        // ⚠ `timeZone: 'UTC'` EXPLÍCITO. Son fechas de CALENDARIO (se calculan
        // con `setUTCDate`), y sin fijarlo se leen en la zona de QUIEN EJECUTA.
        // Hoy sale bien de casualidad —el servidor va en UTC—, pero en cuanto
        // corriera en otra zona el Excel restaría un día, como le pasó al
        // comprobante. Que no dependa del huso de la máquina.
        new Date(p.fechaInicio).toLocaleDateString('es-CO', { timeZone: 'UTC' }),
        new Date(p.fechaFin).toLocaleDateString('es-CO', { timeZone: 'UTC' }),
        p.estado,
        pagado,
        saldo,
      ]
    })

    const data = [...headerRow('Préstamos', null, null), header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(data)

    // Currency columns: B, C, D, J, K (montoPrestado, totalAPagar, cuotaDiaria, pagado, saldo)
    const startRow = 6
    ;['B', 'C', 'D', 'J', 'K'].forEach((col) => setCurrency(ws, col, startRow, startRow + dataRows.length - 1))

    anchos(ws, [26, 14, 14, 10, 12, 14, 14, 14, 12, 12, 14, 14])
    XLSX.utils.book_append_sheet(wb, ws, 'Préstamos')
  }

  // ── PAGOS ─────────────────────────────────────────────────────
  else if (tipo === 'pagos') {
    const rows = await prisma.pago.findMany({
      where: {
        prestamo: { organizationId: orgId, estado: { not: 'cancelado' } },
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
    anchos(ws, [14, 26, 16, 14, 14, 18, 18])
    XLSX.utils.book_append_sheet(wb, ws, 'Pagos')
  }

  // ── COBRADORES ────────────────────────────────────────────────
  else if (tipo === 'cobradores') {
    const rows = await prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador' },
      include: {
        rutas: { where: { activo: true }, take: 1, select: { nombre: true } },
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

    const header = ['Cobrador', 'Ruta', 'Días Trabajados', 'Total Esperado', 'Total Recogido', 'Total Gastos', 'Total Desembolsado', 'Saldo Operativo', 'Saldo Real Caja', 'Diferencia', 'Eficiencia %']
    const dataRows = rows.map((c) => {
      const esperado  = c.cierresCaja.reduce((a, ci) => a + ci.totalEsperado, 0)
      const recogido  = c.cierresCaja.reduce((a, ci) => a + ci.totalRecogido, 0)
      const gastos = c.cierresCaja.reduce((a, ci) => a + (ci.totalGastos || 0), 0)
      const desembolsado = c.cierresCaja.reduce((a, ci) => a + (ci.totalDesembolsado || 0), 0)
      const saldoOperativo = c.cierresCaja.reduce((a, ci) => a + (ci.saldoOperativo ?? (ci.totalRecogido - (ci.totalGastos || 0))), 0)
      const saldoRealCaja = c.cierresCaja.reduce((a, ci) => a + (ci.saldoRealCaja ?? ((ci.totalRecogido - (ci.totalGastos || 0)) - (ci.totalDesembolsado || 0))), 0)
      const eficiencia = esperado > 0 ? Math.round((recogido / esperado) * 100) : 0
      return [
        c.nombre,
        c.rutas[0]?.nombre ?? '',
        c.cierresCaja.length,
        esperado,
        recogido,
        gastos,
        desembolsado,
        saldoOperativo,
        saldoRealCaja,
        recogido - esperado,
        eficiencia,
      ]
    })

    const data = [...headerRow('Cobradores', desde, hasta), header, ...dataRows]
    const ws = XLSX.utils.aoa_to_sheet(data)
    const startRow = 6
    ;['D', 'E', 'F', 'G', 'H', 'I', 'J'].forEach((col) => setCurrency(ws, col, startRow, startRow + dataRows.length - 1))
    anchos(ws, [26, 14, 14, 16, 16, 16, 14])
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
