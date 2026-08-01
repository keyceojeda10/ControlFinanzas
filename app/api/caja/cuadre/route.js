// app/api/caja/cuadre/route.js
// Cuadre del día: el admin verifica y confirma el efectivo que recibe de cada cobrador.
// GET  -> filas de cuadre por cobrador (esperado, recaudado sistema, entregado, recibido,
//         diferencia, estado) + resumen global del día.
// POST -> confirma la recepción del efectivo de un cobrador (o varios en lote), registra
//         quién/cuándo y, si hay diferencia, la asienta como ajuste de capital.

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import { logActividad } from '@/lib/activity-log'
import { registrarMovimientoCapital } from '@/lib/capital'
import { esperadoDeCartera, SELECT_PRESTAMO } from '@/lib/dinero/esperado'
import { getLocalDateStr, getLocalDayRange } from '@/lib/i18n'

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

// Recaudado del sistema por cobrador en el día (pagos reales, sin ajustes).
async function recaudadoPorCobradorDia(organizationId, inicio, fin) {
  const rows = await prisma.pago.groupBy({
    by: ['cobradorId'],
    where: {
      organizationId,
      fechaPago: { gte: inicio, lt: fin },
      tipo: { notIn: ['recargo', 'descuento'] },
      cobradorId: { not: null },
      prestamo: { estado: { not: 'cancelado' } },
    },
    _sum: { montoPagado: true },
  })
  const map = {}
  for (const r of rows) if (r.cobradorId) map[r.cobradorId] = Math.round(r._sum?.montoPagado || 0)
  return map
}

/**
 * Esperado por cobrador PARA LA FECHA que se está cuadrando.
 *
 * ── QUE HABIA AQUI ────────────────────────────────────────────────────────
 *
 * Otra version propia de «cuanto tocaba cobrar»: partia de RUTAS (asi que el
 * cobrador sin ruta activa desaparecia), pasaba `[]` de festivos —o sea que
 * los ignoraba mientras el panel si los descuenta—, y usaba `cuotaDiaria` en
 * vez de la cuota real del periodo.
 *
 * Y sobre todo: preguntaba por HOY aunque el cuadre acepta cualquier fecha.
 * El admin que cuadra el lunes la caja del sabado recibia el esperado del
 * lunes.
 */
async function esperadoPorCobradorDia(organizationId, fecha) {
  const [cobradores, org, festivos] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, rol: 'cobrador', activo: true },
      select: {
        id: true,
        rutas: {
          where: { activo: true },
          select: {
            diasSinCobro: true,
            clientes: {
              where: { estado: { notIn: ['eliminado'] } },
              select: {
                diasSinCobro: true,
                prestamos: {
                  where: { estado: 'activo', esClavo: false },
                  select: SELECT_PRESTAMO,
                },
              },
            },
          },
        },
      },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { diasSinCobro: true } }),
    prisma.festivo.findMany({ where: { organizationId }, select: { fecha: true } }),
  ])

  const map = {}
  for (const c of cobradores) {
    // Se aplanan las rutas del cobrador a una lista de clientes, cada uno con
    // SU ruta: asi un cobrador con dos rutas suma las dos, que es lo que antes
    // se perdia.
    const clientes = c.rutas.flatMap((r) =>
      r.clientes.map((cl) => ({ ...cl, ruta: { diasSinCobro: r.diasSinCobro } })),
    )
    map[c.id] = esperadoDeCartera({ clientes, org, festivos }, fecha).esperado
  }
  return map
}

function estadoDe(cierre, recaudadoSistema) {
  if (!cierre || cierre.confirmadoEn == null) return 'pendiente'
  const dif = Math.round((cierre.efectivoRecibido ?? 0) - recaudadoSistema)
  if (dif === 0) return 'cuadrado'
  return dif < 0 ? 'faltante' : 'sobrante'
}

export async function GET(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const { organizationId, country = 'co' } = session.user
  const { searchParams } = new URL(request.url)
  const fecha = searchParams.get('fecha') || getLocalDateStr(country)
  const { inicio, fin } = getLocalDayRange(fecha, country)

  const [cobradores, recaudadoMap, esperadoMap, cierres, rutas, gastosPorCobrador, orgConfig] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, rol: 'cobrador', activo: true },
      select: { id: true, nombre: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    recaudadoPorCobradorDia(organizationId, inicio, fin),
    esperadoPorCobradorDia(organizationId, fecha),
    prisma.cierreCaja.findMany({ where: { organizationId, fecha: { gte: inicio, lt: fin } } }),
    prisma.ruta.findMany({ where: { organizationId, activo: true }, select: { cobradorId: true, nombre: true, saldoCapital: true } }),
    // Solo gastos PENDIENTES: los aprobados ya descontaron del saldoCapital de
    // la ruta (ver fix en gastos/[id]), así que restarlos otra vez del capital
    // sería doble conteo.
    prisma.gastoMenor.groupBy({
      by: ['cobradorId'],
      where: { organizationId, estado: 'pendiente', fecha: { gte: inicio, lt: fin } },
      _sum: { monto: true },
    }),
    prisma.organization.findUnique({ where: { id: organizationId }, select: { capitalEsEfectivo: true } }),
  ])

  const cierrePorCobrador = {}
  for (const c of cierres) cierrePorCobrador[c.cobradorId] = c
  const rutaPorCobrador = {}
  const capitalPorCobrador = {}
  for (const r of rutas) {
    if (!r.cobradorId) continue
    if (!rutaPorCobrador[r.cobradorId]) rutaPorCobrador[r.cobradorId] = r.nombre
    capitalPorCobrador[r.cobradorId] = Math.round((capitalPorCobrador[r.cobradorId] || 0) + (r.saldoCapital || 0))
  }
  const gastosPorCobradorMap = {}
  for (const g of gastosPorCobrador) if (g.cobradorId) gastosPorCobradorMap[g.cobradorId] = Math.round(g._sum?.monto || 0)

  const filas = cobradores.map((c) => {
    const cierre = cierrePorCobrador[c.id] || null
    const capital = capitalPorCobrador[c.id] || 0
    const gastosDelDia = gastosPorCobradorMap[c.id] || 0
    const recaudadoSistema = orgConfig?.capitalEsEfectivo && capital > 0
      ? capital - gastosDelDia
      : recaudadoMap[c.id] || 0
    const estado = estadoDe(cierre, recaudadoSistema)
    return {
      cobradorId: c.id,
      nombre: c.nombre,
      rutaNombre: rutaPorCobrador[c.id] || 'Sin ruta',
      esperado: esperadoMap[c.id] || 0,
      recaudadoSistema,
      entregadoReportado: cierre ? Math.round(cierre.totalRecogido || 0) : null,
      efectivoRecibido: cierre?.efectivoRecibido != null ? Math.round(cierre.efectivoRecibido) : null,
      diferencia: cierre?.efectivoRecibido != null ? Math.round((cierre.efectivoRecibido) - recaudadoSistema) : null,
      confirmadoEn: cierre?.confirmadoEn || null,
      notaCuadre: cierre?.notaCuadre || null,
      estado,
    }
  })

  // Resumen global del día.
  const confirmados = filas.filter((f) => f.estado !== 'pendiente')
  const resumenGlobal = {
    total: filas.length,
    cuadraron: filas.filter((f) => f.estado === 'cuadrado').length,
    pendientes: filas.filter((f) => f.estado === 'pendiente').length,
    conDiferencia: filas.filter((f) => f.estado === 'faltante' || f.estado === 'sobrante').length,
    faltanteTotal: confirmados.reduce((a, f) => a + Math.min(0, f.diferencia || 0), 0),
    totalRecibido: confirmados.reduce((a, f) => a + (f.efectivoRecibido || 0), 0),
    totalRecaudadoSistema: filas.reduce((a, f) => a + f.recaudadoSistema, 0),
    totalEsperado: filas.reduce((a, f) => a + f.esperado, 0),
  }

  return Response.json({ fecha, filas, resumenGlobal })
}

export async function POST(request) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) return Response.json({ error: 'No autorizado' }, { status: 401 })
  if (session.user.rol !== 'owner') return Response.json({ error: 'Solo el administrador' }, { status: 403 })

  const { organizationId, id: adminId, country = 'co' } = session.user
  const body = await request.json()
  const fecha = typeof body.fecha === 'string' && FECHA_REGEX.test(body.fecha) ? body.fecha : getLocalDateStr(country)
  const { inicio, fin } = getLocalDayRange(fecha, country)

  // El esperado se pide UNA vez para toda la organizacion y para LA FECHA que
  // se cuadra, no una por cobrador dentro del bucle.
  const [orgConfig, esperadoMap] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { capitalEsEfectivo: true } }),
    esperadoPorCobradorDia(organizationId, fecha),
  ])

  // Soporta confirmación individual { cobradorId, efectivoRecibido, nota } o en lote { confirmaciones: [...] }.
  const lista = Array.isArray(body.confirmaciones) && body.confirmaciones.length
    ? body.confirmaciones
    : [{ cobradorId: body.cobradorId, efectivoRecibido: body.efectivoRecibido, nota: body.nota }]

  const resultados = []
  for (const item of lista) {
    const cobradorId = item.cobradorId
    if (!cobradorId) continue
    const cobrador = await prisma.user.findFirst({ where: { id: cobradorId, organizationId, rol: 'cobrador' }, select: { id: true, nombre: true } })
    if (!cobrador) continue

    const efectivoRecibido = Math.round(Number(item.efectivoRecibido ?? 0))

    // Rutas del cobrador: capital + ruta para ajuste contable.
    const rutasCobrador = await prisma.ruta.findMany({
      where: { organizationId, cobradorId, activo: true },
      select: { id: true, saldoCapital: true },
    })
    const ruta = rutasCobrador[0] || null
    const capitalCobrador = Math.round(rutasCobrador.reduce((a, r) => a + (r.saldoCapital || 0), 0))

    // Gastos PENDIENTES del cobrador en el día (los aprobados ya bajaron el
    // saldoCapital de la ruta; restarlos de nuevo sería doble conteo).
    const gastosAgg = await prisma.gastoMenor.aggregate({
      where: { organizationId, cobradorId, estado: 'pendiente', fecha: { gte: inicio, lt: fin } },
      _sum: { monto: true },
    })
    const gastosCobrador = Math.round(gastosAgg._sum?.monto || 0)

    // Lo que de verdad entro ese dia. Se calcula SIEMPRE, aparte de
    // `recaudadoSistema`, porque son dos preguntas distintas y confundirlas es
    // lo que rompio el cierre de este cliente (ver abajo).
    const recaudadoAgg = await prisma.pago.aggregate({
      where: { organizationId, cobradorId, fechaPago: { gte: inicio, lt: fin }, tipo: { notIn: ['recargo', 'descuento'] }, prestamo: { estado: { not: 'cancelado' } } },
      _sum: { montoPagado: true },
    })
    const recaudadoDia = Math.round(recaudadoAgg._sum?.montoPagado || 0)

    // Con `capitalEsEfectivo`, lo que se coteja contra el fajo NO es el cobro
    // del dia sino la bolsa de la ruta: el cobrador entrega todo lo que lleva
    // encima, no solo lo de hoy. Es una pregunta legitima y distinta, y por eso
    // vive en su propia variable.
    const recaudadoSistema = orgConfig?.capitalEsEfectivo && capitalCobrador > 0
      ? capitalCobrador - gastosCobrador
      : recaudadoDia
    const diferenciaRecibido = efectivoRecibido - recaudadoSistema

    const cierreExistente = await prisma.cierreCaja.findFirst({ where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } } })

    const dataConfirmacion = {
      efectivoRecibido,
      diferenciaRecibido,
      confirmadoEn: new Date(),
      confirmadoPorId: adminId,
      notaCuadre: item.nota || null,
    }

    let cierre
    if (cierreExistente) {
      cierre = await prisma.cierreCaja.update({ where: { id: cierreExistente.id }, data: dataConfirmacion })
    } else {
      // El admin cuadra aunque el cobrador no haya cerrado: se crea el cierre
      // con los datos del sistema.
      //
      // ── AQUI ESTABAN LOS CEROS ──────────────────────────────────────────
      //
      // Esto escribia `totalEsperado: 0` y `diferencia: 0` LITERALES. No era
      // un calculo que diera cero: era un cero escrito a mano. De los 2.728
      // cierres de la plataforma, 1.130 (41%) tienen el esperado en cero, y
      // 320 salieron de aqui. Los «cierres exactos» de esos negocios no eran
      // exactos: es que nunca compararon nada.
      //
      // Y `totalRecogido` guardaba `recaudadoSistema`, que con
      // `capitalEsEfectivo` es la BOLSA DE LA RUTA —un saldo acumulado— y no
      // el cobro del dia. El dueño leia un stock creyendo que era un flujo.
      const totalEsperado = esperadoMap[cobradorId] || 0
      cierre = await prisma.cierreCaja.create({
        data: {
          organizationId,
          cobradorId,
          fecha: new Date(fecha + 'T00:00:00-05:00'),
          totalEsperado: Math.round(totalEsperado),
          totalRecogido: recaudadoDia,
          diferencia: Math.round(recaudadoDia - totalEsperado),
          ...dataConfirmacion,
        },
      })
    }

    // Asentar faltante/sobrante como ajuste de capital para no descuadrar la caja.
    if (diferenciaRecibido !== 0) {
      await prisma.$transaction(async (tx) => {
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'ajuste',
          direccion: diferenciaRecibido < 0 ? 'egreso' : 'ingreso',
          monto: Math.abs(diferenciaRecibido),
          descripcion: `Cuadre de caja ${cobrador.nombre} (${fecha}): ${diferenciaRecibido < 0 ? 'faltante' : 'sobrante'}${item.nota ? ' - ' + item.nota : ''}`,
          referenciaId: cierre.id,
          referenciaTipo: 'cierre_cuadre',
          rutaId: ruta?.id || null,
          creadoPorId: adminId,
        })
      })
    }

    logActividad({
      session,
      accion: 'confirmar_cuadre',
      entidadTipo: 'caja',
      entidadId: cierre.id,
      detalle: `Cuadre ${cobrador.nombre} (${fecha}): recibido $${efectivoRecibido.toLocaleString('es-CO')} vs sistema $${recaudadoSistema.toLocaleString('es-CO')} = ${diferenciaRecibido >= 0 ? '+' : ''}$${diferenciaRecibido.toLocaleString('es-CO')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    resultados.push({ cobradorId, efectivoRecibido, recaudadoSistema, diferenciaRecibido, confirmadoEn: cierre.confirmadoEn })
  }

  return Response.json({ confirmados: resultados.length, resultados })
}
