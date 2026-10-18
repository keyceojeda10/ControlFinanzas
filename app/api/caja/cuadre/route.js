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
// La MISMA función que usan el cierre normal y el automático. Este archivo no
// la tenía —estaba duplicada y privada en los otros dos— y por eso escribía 0.
import { calcularDesembolsadoDia } from '@/lib/dinero/desembolsado'
import { getStatsDia } from '@/lib/caja/stats-dia'
import { enLaManoDelDia } from '@/lib/dinero/en-la-mano'

/* Lo que el cobrador tiene en la mano ese día, con la MISMA cuenta de su caja
   (la referencia). Para cuadrar a quien todavía no ha entregado. */
async function enLaManoDe(organizationId, fecha, cobradorId) {
  return Math.round(enLaManoDelDia(await getStatsDia(organizationId, fecha, cobradorId)))
}

const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/

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

  const [cobradores, esperadoMap, cierres, rutas, gastosPorCobrador, orgConfig] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId, rol: 'cobrador', activo: true },
      select: { id: true, nombre: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    esperadoPorCobradorDia(organizationId, fecha),
    prisma.cierreCaja.findMany({ where: { organizationId, fecha: { gte: inicio, lt: fin } } }),
    prisma.ruta.findMany({ where: { organizationId, activo: true }, select: { cobradorId: true, nombre: true, saldoCapital: true, capitalHabilitado: true } }),
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
    // Solo con capital propio (#13): lo mismo que el POST.
    if (r.capitalHabilitado) capitalPorCobrador[r.cobradorId] = Math.round((capitalPorCobrador[r.cobradorId] || 0) + (r.saldoCapital || 0))
  }
  const gastosPorCobradorMap = {}
  for (const g of gastosPorCobrador) if (g.cobradorId) gastosPorCobradorMap[g.cobradorId] = Math.round(g._sum?.monto || 0)

  const filas = await Promise.all(cobradores.map(async (c) => {
    const cierre = cierrePorCobrador[c.id] || null
    const capital = capitalPorCobrador[c.id] || 0
    const gastosDelDia = gastosPorCobradorMap[c.id] || 0
    /* La misma vara que el POST (N3): lo que tenía en la mano al cerrar, o —si
       todavía no ha entregado— lo que tiene ahora, con la cuenta de su caja. */
    const baseEnElFajo = orgConfig?.capitalEsEfectivo && capital > 0
    const recaudadoSistema = baseEnElFajo
      ? capital - gastosDelDia
      : (cierre?.enLaManoSistema != null ? Math.round(cierre.enLaManoSistema) : await enLaManoDe(organizationId, fecha, c.id))
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
  }))

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
      select: { id: true, saldoCapital: true, capitalHabilitado: true },
    })
    const ruta = rutasCobrador[0] || null
    // Solo las rutas con capital propio: una ruta sin él que conserva un
    // `saldoCapital` viejo no es plata que el cobrador cargue (DETALLES-CAJA #13).
    const capitalCobrador = Math.round(rutasCobrador.filter((r) => r.capitalHabilitado).reduce((a, r) => a + (r.saldoCapital || 0), 0))

    // Gastos PENDIENTES del cobrador en el día (los aprobados ya bajaron el
    // saldoCapital de la ruta; restarlos de nuevo sería doble conteo).
    const gastosAgg = await prisma.gastoMenor.aggregate({
      where: { organizationId, cobradorId, estado: 'pendiente', fecha: { gte: inicio, lt: fin } },
      _sum: { monto: true },
    })
    const gastosCobrador = Math.round(gastosAgg._sum?.monto || 0)

    // ⚠ LOS APROBADOS SON OTRA COSA, y hacen falta para el cierre.
    //
    // `gastosCobrador` de arriba son los PENDIENTES, y sirven para el saldo
    // porque los aprobados ya bajaron el capital de la ruta. Pero el campo
    // `totalGastos` del cierre guarda los APROBADOS —así lo hace el cierre
    // normal en `caja/route.js`—, que es lo que de verdad salió ese día.
    //
    // Confundir las dos habría sido un error silencioso: los tipos encajan y
    // las dos son «gastos del cobrador en el día».
    const gastosAprobadosAgg = await prisma.gastoMenor.aggregate({
      where: { organizationId, cobradorId, estado: 'aprobado', fecha: { gte: inicio, lt: fin } },
      _sum: { monto: true },
    })
    const gastosAprobados = Math.round(gastosAprobadosAgg._sum?.monto || 0)


    // Con `capitalEsEfectivo`, lo que se coteja contra el fajo NO es el cobro
    // del dia sino la bolsa de la ruta: el cobrador entrega todo lo que lleva
    // encima, no solo lo de hoy. Es una pregunta legitima y distinta, y por eso
    // vive en su propia variable.
    const cierreExistente = await prisma.cierreCaja.findFirst({ where: { organizationId, cobradorId, fecha: { gte: inicio, lt: fin } } })
    /* ⚠ SIN LA BASE EN EL FAJO SE COTEJA LO QUE TENÍA EN LA MANO (DETALLES-CAJA N3).
       Se cotejaba lo cobrado BRUTO —transferencias incluidas, sin restar lo
       prestado ni los gastos— y el cuadre asentaba en el capital faltantes que
       no existían. Ahora es lo que el sistema decía al cerrar (`enLaManoSistema`,
       la cifra del botón «Usar»). Los cierres de antes no la tienen: ahí queda
       lo de siempre. */
    // Lo que tiene en la mano: lo guardado al cerrar o, si no ha entregado, el de
    // ahora — con la cuenta de su caja, la referencia.
    const enLaMano = cierreExistente?.enLaManoSistema != null
      ? Math.round(cierreExistente.enLaManoSistema)
      : await enLaManoDe(organizationId, fecha, cobradorId)
    const recaudadoSistema = orgConfig?.capitalEsEfectivo && capitalCobrador > 0
      ? capitalCobrador - gastosCobrador
      : enLaMano
    const diferenciaRecibido = efectivoRecibido - recaudadoSistema

    const dataConfirmacion = {
      efectivoRecibido,
      diferenciaRecibido,
      confirmadoEn: new Date(),
      confirmadoPorId: adminId,
      notaCuadre: item.nota || null,
    }

    let cierre
    if (!cierreExistente) {
      /* ══ EL DUEÑO LE CIERRA LA CAJA AL COBRADOR (devuelto el 17 oct 2026) ══
         Se había quitado (#16: «no se cuadra hasta que el cobrador cierre») y
         PRESTA MIL trabaja así: el dueño cuenta la plata y cierra por cada
         cobrador, unas 240 veces al mes. «Desaparecieron los botones… ahora
         depende de los cobradores y no le gustó para nada.» El botón dice que
         CIERRA, y cerrar se deshace reabriendo la caja.

         Las cifras, las mismas que guarda el cobrador cuando cierra él
         (`caja/route.js`): entrega lo que su caja le propone —lo del día, en la
         mano—, los gastos como la caja (pendientes y aprobados) y lo que prestó.
         Lo que el dueño CONTÓ va aparte, en `efectivoRecibido`, y la diferencia
         contra el sistema es el cuadre. */
      const totalEsperado = Math.round(esperadoMap[cobradorId] || 0)
      const totalDesembolsado = Math.round(await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId))
      cierre = await prisma.cierreCaja.create({
        data: {
          organizationId,
          cobradorId,
          fecha: new Date(fecha + 'T00:00:00-05:00'),
          totalEsperado,
          totalRecogido: enLaMano,
          totalGastos: gastosCobrador + gastosAprobados,
          totalDesembolsado,
          saldoOperativo: enLaMano,
          saldoRealCaja: enLaMano,
          enLaManoSistema: enLaMano,
          diferencia: Math.round(enLaMano - totalEsperado),
          ...dataConfirmacion,
        },
      })
    } else {
      // ⚠ SI EL CIERRE VIENE CON EL DESEMBOLSO EN CERO, se rellena aquí.
      //
      // El cuadre solo escribía la confirmación, así que un cierre creado antes
      // de este arreglo se quedaba en cero para siempre aunque el admin lo
      // cuadrara después. Solo se toca cuando está en cero Y de verdad hubo
      // desembolsos: si el cobrador cerró con su cifra, esa manda — no se le
      // pisa un dato que él revisó.
      const faltaDesembolso = !cierreExistente.totalDesembolsado
      const desembolsoReal = faltaDesembolso
        ? Math.round(await calcularDesembolsadoDia(organizationId, inicio, fin, cobradorId))
        : 0
      const ponDesembolso = faltaDesembolso && desembolsoReal > 0

      // Y lo mismo con los gastos, por el mismo motivo: el `create` de abajo no
      // los escribía y quedaban en su `@default(0)`. Medido en producción: 316
      // cierres con gastos en cero habiendo gastado, $15.431.000 en total —
      // todos del mismo cliente, el que reportó el descuadre.
      const ponGastos = !cierreExistente.totalGastos && gastosAprobados > 0

      // El saldo se recalcula UNA vez con las dos correcciones. Hacerlo en dos
      // pasos dejaría la segunda pisando a la primera.
      const operativoFinal = ponGastos
        ? Math.round((cierreExistente.totalRecogido ?? 0) - gastosAprobados)
        : Math.round(cierreExistente.saldoOperativo ?? 0)
      const desembolsoFinal = ponDesembolso
        ? desembolsoReal
        : Math.round(cierreExistente.totalDesembolsado ?? 0)

      cierre = await prisma.cierreCaja.update({
        where: { id: cierreExistente.id },
        data: {
          ...dataConfirmacion,
          ...(ponDesembolso ? { totalDesembolsado: desembolsoReal } : {}),
          /* El saldo con la cuenta vieja solo en los cierres viejos: los nuevos
             guardan lo que tenía en la mano y no se les recalcula (N1/N2). */
          ...(ponGastos ? { totalGastos: gastosAprobados, ...(cierreExistente.enLaManoSistema == null ? { saldoOperativo: operativoFinal } : {}) } : {}),
          ...((ponDesembolso || ponGastos) && cierreExistente.enLaManoSistema == null
            ? { saldoRealCaja: Math.round(operativoFinal - desembolsoFinal) }
            : {}),
        },
      })
    }

    /* Asentar faltante/sobrante como ajuste de capital para no descuadrar la caja.

       ⚠ SOLO LO QUE CAMBIÓ. «Editar» un cuadre ya confirmado asentaba OTRO ajuste
       por la diferencia entera, sin mirar el anterior: corregir un faltante de
       $5.000 a $0 dejaba los $5.000 restados y, si se confirmaba otra vez, los
       restaba dos veces (DETALLES-CAJA-Y-CAPITAL #15). Se suma lo ya asentado
       para este cierre y se asienta la diferencia, en la misma transacción. */
    await prisma.$transaction(async (tx) => {
      const previos = await tx.movimientoCapital.findMany({
        where: { organizationId, referenciaTipo: 'cierre_cuadre', referenciaId: cierre.id },
        select: { monto: true, saldoAnterior: true, saldoNuevo: true },
      })
      const yaAsentado = Math.round(previos.reduce(
        (a, m) => a + (m.saldoNuevo >= m.saldoAnterior ? m.monto : -m.monto), 0,
      ))
      const falta = diferenciaRecibido - yaAsentado
      if (falta === 0) return
      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'ajuste',
        direccion: falta < 0 ? 'egreso' : 'ingreso',
        monto: Math.abs(falta),
        descripcion: `Cuadre de caja ${cobrador.nombre} (${fecha}): ${yaAsentado !== 0 ? 'corrección del cuadre' : (falta < 0 ? 'faltante' : 'sobrante')}${item.nota ? ' - ' + item.nota : ''}`,
        referenciaId: cierre.id,
        referenciaTipo: 'cierre_cuadre',
        rutaId: ruta?.id || null,
        creadoPorId: adminId,
        permitirNegativo: true,
      })
    })

    logActividad({
      session,
      accion: 'confirmar_cuadre',
      entidadTipo: 'caja',
      entidadId: cierre.id,
      detalle: `${cierreExistente ? 'Cuadre' : 'Cerró la caja y cuadró a'} ${cobrador.nombre} (${fecha}): recibido $${efectivoRecibido.toLocaleString('es-CO')} vs sistema $${recaudadoSistema.toLocaleString('es-CO')} = ${diferenciaRecibido >= 0 ? '+' : ''}$${diferenciaRecibido.toLocaleString('es-CO')}`,
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim(),
    })

    resultados.push({ cobradorId, efectivoRecibido, recaudadoSistema, diferenciaRecibido, confirmadoEn: cierre.confirmadoEn })
  }

  const errores = resultados.filter((r) => r.error)
  // Si ninguno se pudo cuadrar, se dice por qué.
  if (errores.length && errores.length === resultados.length) {
    return Response.json({ error: errores[0].error, resultados }, { status: 409 })
  }
  return Response.json({ confirmados: resultados.length - errores.length, resultados })
}
