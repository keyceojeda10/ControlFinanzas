// app/api/capital/resumen/route.js
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { capitalEnCalle as capitalEnCalleDe } from '@/lib/dinero/reparto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function netoAjustes(movimientos = []) {
  return movimientos.reduce((acc, mov) => {
    const esIngreso = mov.saldoNuevo >= mov.saldoAnterior
    return acc + (esIngreso ? mov.monto : -mov.monto)
  }, 0)
}

// Suma los ajustes que reversan un desembolso o recaudo del mismo mes (préstamo
// eliminado, pago anulado, edición de monto), para no inflar "Prestado"/"Cobrado"
// con actividad que ya fue revertida.
function sumaReversiones(movimientos = [], prefijo) {
  return movimientos.reduce((acc, mov) => {
    return mov.descripcion?.startsWith(prefijo) ? acc + mov.monto : acc
  }, 0)
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  if (session.user.rol !== 'owner') {
    return Response.json({ error: 'Solo el administrador' }, { status: 403 })
  }

  const { organizationId } = session.user

  const capital = await prisma.capital.findUnique({ where: { organizationId } })

  // Primer día del mes actual (timezone Colombia UTC-5)
  const now = new Date()
  const colombiaOffset = -5
  const colombiaDate = new Date(now.getTime() + colombiaOffset * 60 * 60 * 1000)
  const inicioMes = new Date(Date.UTC(colombiaDate.getUTCFullYear(), colombiaDate.getUTCMonth(), 1) - colombiaOffset * 60 * 60 * 1000)

  const [
    desembolsos,
    recaudos,
    gastos,
    inyecciones,
    retiros,
    ajustes,
    prestamosHistoricos,
    pagosHistoricos,
    gastosHistoricos,
    movimientosManualesHistoricos,
    refsPrestamos,
    refsPagos,
    refsGastos,
  ] = await Promise.all([
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'desembolso', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'recaudo', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'gasto', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'inyeccion', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.aggregate({
      where: { organizationId, tipo: 'retiro', createdAt: { gte: inicioMes } },
      _sum: { monto: true },
    }),
    prisma.movimientoCapital.findMany({
      where: { organizationId, tipo: 'ajuste', createdAt: { gte: inicioMes } },
      select: { monto: true, saldoAnterior: true, saldoNuevo: true, descripcion: true },
    }),
    prisma.prestamo.aggregate({
      where: { organizationId, estado: { not: 'cancelado' } },
      _sum: { montoPrestado: true },
      _count: true,
    }),
    prisma.pago.aggregate({
      where: { organizationId, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true },
      _count: true,
    }),
    prisma.gastoMenor.aggregate({
      where: { organizationId, estado: 'aprobado' },
      _sum: { monto: true },
      _count: true,
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: { in: ['capital_inicial', 'inyeccion', 'retiro', 'ajuste'] },
      },
      select: {
        tipo: true,
        monto: true,
        saldoAnterior: true,
        saldoNuevo: true,
      },
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        referenciaTipo: 'prestamo',
        referenciaId: { not: null },
      },
      select: { referenciaId: true },
      distinct: ['referenciaId'],
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'recaudo',
        referenciaTipo: 'pago',
        referenciaId: { not: null },
      },
      select: { referenciaId: true },
      distinct: ['referenciaId'],
    }),
    prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'gasto',
        referenciaTipo: 'gasto',
        referenciaId: { not: null },
      },
      select: { referenciaId: true },
      distinct: ['referenciaId'],
    }),
  ])

  const desembolsado = (desembolsos._sum.monto ?? 0) - sumaReversiones(ajustes, 'Reverso desembolso')
  const recaudado = (recaudos._sum.monto ?? 0) - sumaReversiones(ajustes, 'Reverso recaudo') - sumaReversiones(ajustes, 'Reverso pago anulado')
  const gastado = gastos._sum.monto ?? 0
  const inyectado = inyecciones._sum.monto ?? 0
  const retirado = retiros._sum.monto ?? 0
  const ajustesNetos = netoAjustes(ajustes)
  const flujoOperativo = recaudado - desembolsado - gastado
  const flujoCajaTotal = flujoOperativo + inyectado - retirado + ajustesNetos

  const componentesManuales = movimientosManualesHistoricos.reduce((acc, mov) => {
    if (mov.tipo === 'capital_inicial') acc.capitalInicial += mov.monto
    if (mov.tipo === 'inyeccion') acc.inyecciones += mov.monto
    if (mov.tipo === 'retiro') acc.retiros += mov.monto
    if (mov.tipo === 'ajuste') {
      const esIngreso = mov.saldoNuevo >= mov.saldoAnterior
      acc.ajustes += esIngreso ? mov.monto : -mov.monto
    }
    return acc
  }, {
    capitalInicial: 0,
    inyecciones: 0,
    retiros: 0,
    ajustes: 0,
  })

  /* ⚠ AQUÍ SÍ VA LA SUMA DE `montoPrestado`, Y NO ES EL MISMO CASO QUE LA CAJA.
     Lo cambié al efectivo real —como en la caja del día— y MEDÍ QUE EMPEORABA:
     de 22 organizaciones con renovaciones, 16 se ALEJARON del saldo real.
     «Inversiones divinas» pasaba de desviarse $393.394 a $27.360.106.

     El motivo: esto no es el flujo de caja de un día, es una reconstrucción del
     LEDGER completo. Y el ledger apunta la renovación por los dos lados: el
     desembolso por lo que salió Y el recaudo que salda el préstamo viejo. Si
     aquí se resta solo el efectivo, la deuda absorbida se deja de contar en un
     lado y la cuenta se descuadra.

     En la caja del día es al revés: ahí solo interesa el efectivo que salió del
     bolsillo del cobrador. Ver `calcularDesembolsadoDia`. */
  const prestadoHistorico = prestamosHistoricos._sum?.montoPrestado ?? 0
  const cobradoHistorico = pagosHistoricos._sum?.montoPagado ?? 0
  const gastoHistorico = gastosHistoricos._sum?.monto ?? 0
  const baseManual = componentesManuales.capitalInicial + componentesManuales.inyecciones - componentesManuales.retiros + componentesManuales.ajustes
  const saldoSugerido = baseManual + cobradoHistorico - prestadoHistorico - gastoHistorico

  const totalPrestamosHistoricos = prestamosHistoricos._count ?? 0
  const totalPagosHistoricos = pagosHistoricos._count ?? 0
  const totalGastosHistoricos = gastosHistoricos._count ?? 0

  const coberturaPrestamos = totalPrestamosHistoricos > 0 ? Math.min(1, refsPrestamos.length / totalPrestamosHistoricos) : 1
  const coberturaPagos = totalPagosHistoricos > 0 ? Math.min(1, refsPagos.length / totalPagosHistoricos) : 1
  const coberturaGastos = totalGastosHistoricos > 0 ? Math.min(1, refsGastos.length / totalGastosHistoricos) : 1
  const coberturaPromedio = (coberturaPrestamos + coberturaPagos + coberturaGastos) / 3

  const calidadSugerencia = coberturaPromedio >= 0.98
    ? 'alta'
    : coberturaPromedio >= 0.85
      ? 'media'
      : 'baja'

  const saldoPersistido = capital?.saldo ?? 0
  const diferenciaVsPersistido = saldoPersistido - saldoSugerido

  const [carteraAgregada, carteraSinRuta, prestamosVivos] = await Promise.all([
    prisma.prestamo.aggregate({
      where: { organizationId, estado: 'activo', esClavo: false },
      _sum: { totalAPagar: true, totalPagado: true, montoPrestado: true },
      _count: true,
    }),
    prisma.prestamo.aggregate({
      where: { organizationId, estado: 'activo', esClavo: false, cliente: { rutaId: null } },
      _sum: { totalAPagar: true, totalPagado: true },
      _count: true,
    }),
    // «Capital en la calle» no se puede agregar en la base: depende de la tabla
    // de amortizacion de cada prestamo y de sus abonos a capital. Se traen los
    // activos con lo justo. `Σ montoPrestado` —lo que habia— no contesta esa
    // pregunta: contesta «cuanto sali a prestar alguna vez», que sobre la
    // cartera real es un 37,2% mas.
    prisma.prestamo.findMany({
      where: { organizationId, estado: 'activo', esClavo: false },
      select: {
        montoPrestado: true, totalAPagar: true, totalPagado: true, modoInteres: true,
        cuotasAmortizacion: { select: { numeroPeriodo: true, cuotaTotal: true, interes: true } },
        pagos: { where: { tipo: 'capital' }, select: { tipo: true, montoPagado: true } },
      },
    }),
  ])
  const carteraTotal = Math.max(0, (carteraAgregada._sum.totalAPagar ?? 0) - (carteraAgregada._sum.totalPagado ?? 0))
  const capitalEnCalle = prestamosVivos.reduce((acc, p) => acc + capitalEnCalleDe(p), 0)
  const prestamosActivosTotal = carteraAgregada._count ?? 0
  const carteraSinRutaTotal = Math.max(0, (carteraSinRuta._sum.totalAPagar ?? 0) - (carteraSinRuta._sum.totalPagado ?? 0))
  const prestamosSinRuta = carteraSinRuta._count ?? 0

  return Response.json({
    configurado: Boolean(capital),
    saldo: saldoPersistido,
    sugerido: {
      saldo: Math.round(saldoSugerido),
      diferenciaVsPersistido: Math.round(diferenciaVsPersistido),
      calidad: calidadSugerencia,
      cobertura: {
        prestamos: Math.round(coberturaPrestamos * 100),
        pagos: Math.round(coberturaPagos * 100),
        gastos: Math.round(coberturaGastos * 100),
      },
      componentes: {
        baseManual: Math.round(baseManual),
        capitalInicial: Math.round(componentesManuales.capitalInicial),
        inyecciones: Math.round(componentesManuales.inyecciones),
        retiros: Math.round(componentesManuales.retiros),
        ajustes: Math.round(componentesManuales.ajustes),
        prestadoHistorico: Math.round(prestadoHistorico),
        cobradoHistorico: Math.round(cobradoHistorico),
        gastoHistorico: Math.round(gastoHistorico),
      },
    },
    cartera: {
      total: Math.round(carteraTotal),
      capitalEnCalle: Math.round(capitalEnCalle),
      prestamosActivos: prestamosActivosTotal,
      sinRuta: Math.round(carteraSinRutaTotal),
      prestamosSinRuta,
    },
    mes: {
      desembolsado,
      recaudado,
      gastos: gastado,
      inyectado,
      retirado,
      ajustesNetos,
      flujoNeto: flujoOperativo,
      flujoCajaTotal,
      prestamosOtorgados: desembolsos._count,
      pagosRecibidos: recaudos._count,
    },
  }, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
      'Pragma': 'no-cache',
    },
  })
}
