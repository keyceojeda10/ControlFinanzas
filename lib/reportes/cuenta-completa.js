// lib/reportes/cuenta-completa.js — la cuenta entera en un solo Excel.
//
// ══ POR QUÉ EXISTE ═════════════════════════════════════════════════════════
//
// El dueño, con las palabras de su cliente:
//
//   «él quiere donde le salgan los clientes, con lo que debe, o sea todo, todo
//    el desglose, todo en un Excel. De clientes, préstamo, lo que debe, fechas
//    de pago, cobro, todo, todo, con todas las columnas.»
//   «ese es el reporte que más atención habría que colocarle.»
//
// Lo que había eran CUATRO archivos sueltos y flacos:
//
//   Clientes    6 columnas — y NINGUNA decía cuánto debe
//   Préstamos  11 columnas — sin cédula, sin teléfono, sin ruta, sin mora
//   Pagos       4 columnas — fecha, cliente, cobrador, monto
//   Cobradores  la caja
//
// Para armar la foto de su cartera había que bajarse los cuatro y cruzarlos a
// mano. La hoja CARTERA de aquí es esa foto: una fila por préstamo con la
// persona pegada, lo que va pagado, lo que debe, la mora y las fechas.
//
// ⚠ LAS CIFRAS SALEN DE `lib/calculos`, NO DE UNA RESTA LOCAL.
//
// La hoja vieja de Préstamos calculaba `saldo = totalAPagar − suma(pagos)`, que
// ignora la tabla de amortización, los abonos a capital y la cascada. Un Excel
// que no cuadra con la pantalla es peor que no tenerlo: el prestamista se lo
// lleva al contador y termina discutiendo con su propio sistema. Aquí se usan
// las MISMAS funciones que pintan la ficha.

import * as XLSX from 'xlsx'
import { prisma } from '@/lib/prisma'
import {
  calcularSaldoPendiente, calcularDiasMora, calcularMontoEnMora,
  calcularProximoCobro, calcularCapitalRestante,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'

// Los nombres que ve el prestamista, no el enum de la base.
const MODO = {
  fijo: 'Cuota fija',
  lineal: 'Decreciente',
  lineal_dinamico: 'Decreciente dinámico',
  solo_interes: 'Solo interés (globo)',
  saldo: 'Sobre saldo',
  unico: 'Cuota única',
  manual: 'Manual',
}

/* ⚠ `timeZone: 'UTC'` EXPLÍCITO. Son fechas de CALENDARIO —se calculan con
   `setUTCDate`— y sin fijarlo se leen en la zona de QUIEN EJECUTA. Hoy saldría
   bien de casualidad porque el servidor va en UTC, pero el día que corra en
   otra zona el Excel restaría un día entero, como ya le pasó al comprobante. */
const fecha = (d) => (d ? new Date(d).toLocaleDateString('es-CO', { timeZone: 'UTC' }) : '')

function cabecera(titulo, desde, hasta) {
  return [
    [`Control Finanzas — ${titulo}`],
    [desde && hasta ? `Período: ${desde} al ${hasta}` : 'Todos los registros (sin filtro de fecha)'],
    [`Generado: ${new Date().toLocaleString('es-CO')}`],
    [],
  ]
}

/* Arma una hoja con su cabecera, sus anchos y sus columnas de plata.
   Sin `!cols`, Excel abre a ~8 caracteres y «$123.456.789» sale como #########.
   Y la fila donde empiezan los datos se calcula, no se escribe a mano: estaba
   copiada cuatro veces con el `startRow` puesto a dedo. */
function hoja(wb, nombre, titulo, periodo, encabezados, filas, colsPlata, anchos) {
  const cab = cabecera(titulo, periodo?.desde ?? null, periodo?.hasta ?? null)
  const ws = XLSX.utils.aoa_to_sheet([...cab, encabezados, ...filas])
  const primera = cab.length + 2
  for (const col of colsPlata) {
    for (let r = primera; r <= primera + filas.length - 1; r++) {
      const ref = `${col}${r}`
      if (!ws[ref]) continue
      ws[ref].z = '"$"#,##0'
      ws[ref].t = 'n'
    }
  }
  ws['!cols'] = anchos.map((wch) => ({ wch }))
  // Congela la fila de encabezados: con 24 columnas y 400 filas, sin esto se
  // pierde de vista qué es cada columna en cuanto se baja.
  ws['!freeze'] = { xSplit: 0, ySplit: primera - 1 }
  XLSX.utils.book_append_sheet(wb, ws, nombre)
}

export async function construirCuentaCompleta(orgId, { desde, hasta, fechaDesde, fechaHasta }) {
  const [org, festivos, clientes, pagos, cobradores] = await Promise.all([
    prisma.organization.findUnique({ where: { id: orgId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId: orgId }, select: { fecha: true } }),
    prisma.cliente.findMany({
      where: { organizationId: orgId, estado: { notIn: ['eliminado'] } },
      include: {
        ruta: { select: { nombre: true, diasSinCobro: true, cobrador: { select: { nombre: true } } } },
        prestamos: {
          orderBy: { fechaInicio: 'asc' },
          include: {
            /* ⚠ SOLO LOS ABONOS A CAPITAL, y no es un atajo: es lo ÚNICO que
               se lee de aquí.
               · `calcularSaldoPendiente` va por `totalPagado`, el campo
                 denormalizado, y ni toca `pagos`.
               · `calcularCapitalRestante` solo mira los de tipo 'capital',
                 porque esos bajan el capital directo sin entrar al reparto.
               Traerlos todos costaba **9.330 filas** en el negocio más grande
               —1.455 clientes, 2.102 préstamos— y el archivo no llegaba a
               generarse. Con el filtro son unas pocas decenas.
               El detalle de pagos SÍ va completo, pero en su propia hoja y con
               una consulta plana, que es barata. */
            pagos: { where: { tipo: 'capital' }, select: { montoPagado: true, tipo: true } },
            cuotasAmortizacion: {
              orderBy: { numeroPeriodo: 'asc' },
              select: {
                numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true,
                pagado: true, interesPagado: true, fechaEsperada: true,
              },
            },
          },
        },
      },
      orderBy: { nombre: 'asc' },
    }),
    prisma.pago.findMany({
      where: { organizationId: orgId, fechaPago: { gte: fechaDesde, lte: fechaHasta } },
      include: {
        prestamo: { select: { fechaInicio: true, cliente: { select: { nombre: true, cedula: true } } } },
        cobrador: { select: { nombre: true } },
      },
      orderBy: { fechaPago: 'desc' },
    }),
    prisma.user.findMany({
      where: { organizationId: orgId, rol: 'cobrador' },
      select: {
        nombre: true, email: true, telefono: true, activo: true,
        rutas: { where: { activo: true }, select: { nombre: true } },
      },
      orderBy: { nombre: 'asc' },
    }),
  ])

  const fest = festivos.map((f) => f.fecha)
  const wb = XLSX.utils.book_new()

  // ── 1 · CARTERA. La hoja que pidió: todo junto, sin cruzar nada. ──
  const cartera = []
  for (const c of clientes) {
    for (const p of c.prestamos) {
      const dexc = obtenerDiasSinCobro(c, c.ruta, org, p)
      cartera.push([
        c.nombre, c.cedula ?? '', c.telefono ?? '', c.direccion ?? c.referencia ?? '',
        c.ruta?.nombre ?? 'Sin ruta', c.ruta?.cobrador?.nombre ?? '',
        p.montoPrestado, p.totalAPagar, p.cuotaDiaria,
        p.frecuencia, MODO[p.modoInteres] ?? p.modoInteres, p.tasaInteres, p.diasPlazo,
        fecha(p.fechaInicio), fecha(p.fechaFin), p.estado,
        Number(p.totalPagado ?? 0),
        calcularSaldoPendiente(p),
        calcularCapitalRestante(p),
        calcularDiasMora(p, dexc, fest),
        calcularMontoEnMora(p, dexc, fest),
        fecha(calcularProximoCobro(p, dexc, fest)),
        fecha(p.ultimoPagoAt),
        p.esClavo ? 'Sí' : '',
      ])
    }
  }
  hoja(wb, 'Cartera', 'Cartera completa', null,
    ['Cliente', 'Cédula', 'Teléfono', 'Dirección', 'Ruta', 'Cobrador',
      'Monto prestado', 'Total a pagar', 'Cuota', 'Frecuencia', 'Modo de interés', 'Tasa %', 'Plazo (días)',
      'Inicio', 'Vence', 'Estado', 'Pagado', 'Saldo', 'Capital restante',
      'Días de mora', 'Atraso $', 'Próximo cobro', 'Último pago', 'Perdido'],
    cartera,
    ['G', 'H', 'I', 'Q', 'R', 'S', 'U'],
    [26, 14, 14, 30, 16, 20, 15, 15, 13, 12, 19, 8, 12, 12, 12, 12, 14, 14, 15, 12, 14, 14, 13, 9])

  // ── 2 · CLIENTES, ahora sí con lo que debe ──
  const filasClientes = clientes.map((c) => {
    const activos = c.prestamos.filter((p) => p.estado === 'activo')
    const debe = activos.reduce((a, p) => a + calcularSaldoPendiente(p), 0)
    const mora = activos.reduce(
      (m, p) => Math.max(m, calcularDiasMora(p, obtenerDiasSinCobro(c, c.ruta, org, p), fest)), 0)
    const ultimo = activos.map((p) => p.ultimoPagoAt).filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0]
    return [
      c.nombre, c.cedula ?? '', c.telefono ?? '', c.direccion ?? c.referencia ?? '',
      c.ruta?.nombre ?? 'Sin ruta', c.estado,
      c.prestamos.length, activos.length, debe, mora, fecha(ultimo),
    ]
  })
  hoja(wb, 'Clientes', 'Clientes', null,
    ['Nombre', 'Cédula', 'Teléfono', 'Dirección', 'Ruta', 'Estado',
      'Préstamos', 'Activos', 'Debe hoy', 'Días de mora', 'Último pago'],
    filasClientes, ['I'], [26, 14, 14, 30, 16, 12, 11, 9, 14, 13, 13])

  // ── 3 · PAGOS ──
  hoja(wb, 'Pagos', 'Pagos', { desde, hasta },
    ['Fecha', 'Cliente', 'Cédula', 'Préstamo (inicio)', 'Cobrador', 'Monto', 'Tipo', 'Método', 'Nota'],
    pagos.map((p) => [
      fecha(p.fechaPago), p.prestamo?.cliente?.nombre ?? '', p.prestamo?.cliente?.cedula ?? '',
      fecha(p.prestamo?.fechaInicio), p.cobrador?.nombre ?? '', p.montoPagado,
      p.tipo, p.metodoPago ?? '', (p.nota ?? '').slice(0, 120),
    ]),
    ['F'], [13, 26, 14, 16, 22, 14, 13, 13, 34])

  // ── 4 · COBRADORES ──
  hoja(wb, 'Cobradores', 'Cobradores', null,
    ['Cobrador', 'Correo', 'Teléfono', 'Rutas', 'Activo'],
    cobradores.map((c) => [
      c.nombre, c.email ?? '', c.telefono ?? '',
      c.rutas.map((r) => r.nombre).join(', '), c.activo ? 'Sí' : 'No',
    ]),
    [], [26, 26, 14, 30, 9])

  return { wb, filas: { cartera: cartera.length, clientes: filasClientes.length, pagos: pagos.length } }
}
