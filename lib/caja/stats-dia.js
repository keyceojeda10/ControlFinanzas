// lib/caja/stats-dia.js — Las cifras del día de una caja (de un cobrador o de todo
// el negocio). Vivían dentro de `app/api/caja/route.js`, y una ruta de Next no
// puede exportar funciones sueltas: el cuadre, que necesita «lo que el cobrador
// tiene en la mano» cuando el dueño le cierra la caja, no tenía cómo pedirla
// sin escribir la cuenta otra vez. Se movieron TAL CUAL el 17 oct 2026; la caja
// del cobrador sigue siendo la referencia ([[dos_cajas_mismo_numero]]).
import { prisma }           from '@/lib/prisma'
import { esperadoDeCartera, selectPrestamoDelDia } from '@/lib/dinero/esperado'
import { conciliar, resumirLibro, loQueSeMovio, ALCANCE } from '@/lib/dinero/conciliacion'
import { cuentasDelCobrador, entraAlFajo } from '@/lib/dinero/cuentas'
import { getLocalDayRange } from '@/lib/i18n'
import { detalleDesembolsadoDia } from '@/lib/dinero/desembolsado'
import { SIN_ABONO_PREVIO, prestamosMigrados } from '@/lib/dinero/abono-previo'


// Las rutas de un cobrador. Lo que el cobrador entiende por «lo mio» son sus
// rutas, no solo lo que registro el: el dueño tambien cobra en sus rutas. Es la
// misma regla que ya usa el detalle del cobrador, y la lista NO usaba — por eso
// el mismo cobrador el mismo dia daba dos cifras distintas segun donde miraras.
export async function rutaIdsDe(organizationId, cobradorId) {
  if (!cobradorId) return []
  const rutas = await prisma.ruta.findMany({
    where: { organizationId, cobradorId, activo: true },
    select: { id: true },
  })
  return rutas.map((r) => r.id)
}

export const getDayRange = (fechaLocal, country = 'co') => getLocalDayRange(fechaLocal, country)

// Calcula el total esperado real desde los préstamos activos de las rutas.
// Respeta la jerarquía de días sin cobro cliente→ruta→org: si HOY es día sin cobro
// para ese cliente, su cuota no se espera (el cobrador no tiene por qué cobrarla).
export async function calcularEsperadoReal(organizationId, cobradorId = null, fecha = null) {
  // Se parte de los CLIENTES, no de las rutas.
  //
  // Antes esto arrancaba en prisma.ruta.findMany e iteraba ruta.clientes, asi
  // que un cliente sin ruta asignada era invisible para la meta. Con cero rutas
  // —el estado normal del 95% de las organizaciones, porque el onboarding no
  // crea ninguna— el resultado era literalmente 0: la caja decia "Esperado $0"
  // y "Diferencia +todo lo cobrado", mientras el dashboard mostraba la meta
  // real. Dos pantallas de la misma app contradiciendose el mismo dia.
  //
  // Ahora usa el mismo criterio que /api/dashboard/resumen: recorre prestamos
  // activos y pregunta por cada uno si su ciclo de cobro toca hoy. La ruta pasa
  // a ser solo un filtro opcional, cuando se pide la caja de un cobrador.
  const [clientes, org, festivos] = await Promise.all([
    prisma.cliente.findMany({
      where: {
        organizationId,
        estado: { notIn: ['eliminado'] },
        ...(cobradorId ? { ruta: { cobradorId, activo: true } } : {}),
      },
      select: {
        diasSinCobro: true,
        ruta: { select: { diasSinCobro: true } },
        prestamos: {
          // El clavo no genera cuota esperada (es el lado negativo): se excluye de la meta.
          where: { estado: 'activo', esClavo: false },
          // El `select` sale del propio modulo. Cada uno de los cinco
          // llamadores tenia el suyo escrito a mano, y es asi como empezaron a
          // divergir: al que se le olvidaba `modoInteres` y
          // `cuotasAmortizacion` caia a `cuotaDiaria`, que en Decreciente es
          // la cuota MAS ALTA y en Globo es solo el interes.
          select: selectPrestamoDelDia(),
        },
      },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    // La caja pasaba [] como festivos, o sea que los ignoraba, mientras el
    // dashboard si los descuenta. Otra razon por la que las dos pantallas no
    // cuadraban.
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  // Meta del dia: solo cuenta cuotas de prestamos cuyo ciclo de cobro toca esa
  // fecha (segun frecuencia + dia ancla). La cuenta la hace `lib/dinero/esperado.js`,
  // que es la MISMA que usan el cuadre, el cierre automatico y la ficha de ruta.
  //
  // `fecha` es nueva y no es un adorno: el cierre de caja admite hasta 7 dias
  // atras, y hasta ahora guardaba el esperado de HOY para el dia que fuera.
  return esperadoDeCartera({ clientes, org, festivos }, fecha ?? new Date()).esperado
}

// Calcula desembolsos realizados en el día para reflejar el saldo real de caja.

// Devuelve DOS cifras del dia que no son lo mismo y hoy se confundian:
//
//   valorPrestado     = suma de montoPrestado (el valor de las cartulinas)
//   efectivoEntregado = plata que de verdad salio de la caja
//
// Se separan en las renovaciones: si renueva una de $100 a un cliente que debia
// $50, el valor prestado es $100 pero de la caja solo salen $50. El cliente que
// mas cobradores tiene lo pidio asi: "aca me muestra lo que le entrego en
// efectivo y aca que me muestre la totalidad de los prestamos que hago en el
// dia... para yo saber cuanto presta el cobrador en el dia".
//
// NO reemplaza a calcularDesembolsadoDia: esa sigue alimentando el saldo de caja
// y no se toca. Esto es aditivo, solo para mostrar.
//
// El universo (que prestamos cuentan) es el MISMO que usa el desembolsado, para
// que las cifras sean comparables entre si:
//   sin cobradorId -> todos los prestamos de la organizacion
//   con cobradorId -> los de sus rutas + los que el creo + sus movimientos
export async function calcularPrestadoDetalleDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWherePrestamos = {
    organizationId,
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Mapa prestamo -> monto realmente entregado (el movimiento de capital manda:
  // en renovaciones guarda la diferencia en mano, no el montoPrestado completo).
  const construirMapaEntregado = async (whereMov) => {
    const movs = await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        tipo: 'desembolso',
        /* ⚠ LA RESERVA DE RUTA NO ES PLATA ENTREGADA.
           Al asignar clientes a una ruta con capital se asienta un `desembolso`
           con `ajusteArranqueRuta`: mueve la bolsa de la ruta, no la caja
           (`saldoAnterior` y `saldoNuevo` idénticos). Y como aquí «gana el más
           reciente», ese asiento le pisaba al préstamo su desembolso de verdad:
           a Inversiones L&D le decía que entregó $600.000 donde entregó $500.000,
           dos veces, y salían $200.000 «de préstamos que no cuadran».
           Es el mismo fallo que `afectaCaja`, por la otra vía. */
        ajusteArranqueRuta: false,
        createdAt: { gte: inicio, lt: fin },
        referenciaTipo: 'prestamo',
        ...whereMov,
      },
      select: { referenciaId: true, monto: true, createdAt: true },
    })
    const mapa = new Map()
    for (const m of movs) {
      if (!m.referenciaId) continue
      const prev = mapa.get(m.referenciaId)
      // el mas reciente gana, por si el movimiento se edito
      if (!prev || m.createdAt > prev.createdAt) mapa.set(m.referenciaId, m)
    }
    return mapa
  }

  if (!cobradorId) {
    const [prestamos, mapaEntregado] = await Promise.all([
      prisma.prestamo.findMany({
        where: baseWherePrestamos,
        select: { id: true, montoPrestado: true, renovadoDeId: true },
      }),
      construirMapaEntregado({}),
    ])
    // Los migrados no se entregaron hoy (ver `lib/dinero/abono-previo.js`).
    const migrados = await prestamosMigrados(prisma, prestamos.map((p) => p.id))
    const deHoy = prestamos.filter((p) => !migrados.has(p.id))
    let valorPrestado = 0
    let efectivoEntregado = 0
    for (const p of deHoy) {
      valorPrestado += p.montoPrestado || 0
      const mov = mapaEntregado.get(p.id)
      // Sin movimiento: en renovacion el efectivo entregado no es el monto nuevo
      // (incluye el saldo viejo absorbido, que nunca salio de la caja).
      efectivoEntregado += mov ? mov.monto : (p.renovadoDeId ? 0 : (p.montoPrestado || 0))
    }
    return {
      valorPrestado: Math.round(valorPrestado),
      efectivoEntregado: Math.round(efectivoEntregado),
      cantidadPrestamos: deHoy.length,
    }
  }

  // ── Vista por cobrador ──
  const rutasCobrador = await prisma.ruta.findMany({
    where: { cobradorId, organizationId, activo: true },
    select: { id: true },
  })
  const rutaIds = rutasCobrador.map(r => r.id)

  const prestamosRuta = await prisma.prestamo.findMany({
    where: { ...baseWherePrestamos, cliente: { ruta: { cobradorId } } },
    select: { id: true, montoPrestado: true, renovadoDeId: true },
  })
  // Y los asientos de sus préstamos aunque no lleven su ruta: ver la nota de
  // `detalleDesembolsadoDia` (el dueño, sin capital por ruta).
  const idsDeSusRutas = prestamosRuta.map((p) => p.id)
  const [actividadesCreador, mapaEntregado] = await Promise.all([
    prisma.actividadLog.findMany({
      where: {
        organizationId,
        userId: cobradorId,
        accion: 'crear_prestamo',
        createdAt: { gte: inicio, lt: fin },
      },
      select: { entidadId: true },
    }),
    construirMapaEntregado({
      OR: [
        { creadoPorId: cobradorId },
        ...(rutaIds.length > 0 ? [{ rutaId: { in: rutaIds } }] : []),
        ...(idsDeSusRutas.length > 0 ? [{ referenciaId: { in: idsDeSusRutas } }] : []),
      ],
    }),
  ])

  const idsActividad = actividadesCreador.map(a => a.entidadId).filter(Boolean)
  const prestamosActividad = idsActividad.length
    ? await prisma.prestamo.findMany({
      where: {
        organizationId,
        id: { in: idsActividad },
        createdAt: { gte: inicio, lt: fin },
        estado: { not: 'cancelado' },
      },
      select: { id: true, montoPrestado: true, renovadoDeId: true },
    })
    : []

  const vistos = new Set()
  let valorPrestado = 0
  let efectivoEntregado = 0
  let cantidad = 0
  // Los migrados no se entregaron hoy (ver `lib/dinero/abono-previo.js`).
  const migrados = await prestamosMigrados(prisma, [...prestamosRuta, ...prestamosActividad].map((p) => p.id).concat([...mapaEntregado.keys()]))

  for (const p of [...prestamosRuta, ...prestamosActividad]) {
    if (vistos.has(p.id)) continue
    vistos.add(p.id)
    if (migrados.has(p.id)) continue
    cantidad += 1
    valorPrestado += p.montoPrestado || 0
    const mov = mapaEntregado.get(p.id)
    // Sin movimiento: una renovacion no entrego el monto nuevo en efectivo.
    efectivoEntregado += mov ? mov.monto : (p.renovadoDeId ? 0 : (p.montoPrestado || 0))
  }

  // Movimientos sin prestamo en ruta ni actividad (ej: el owner desembolso en su
  // ruta). Sin el montoPrestado a mano, el movimiento es la mejor cifra de ambas.
  const idsFaltantes = [...mapaEntregado.keys()].filter(id => !vistos.has(id))
  if (idsFaltantes.length) {
    const [sueltos, borradosEseDia] = await Promise.all([
      prisma.prestamo.findMany({
        where: { organizationId, id: { in: idsFaltantes } },
        select: { id: true, montoPrestado: true },
      }),
      /* El préstamo que se creó y se borró el mismo día no se prestó: el libro
         anula el par (`resumirLibro`) y aquí tampoco cuenta. Solo si se borró
         ESE día: si se borró después, aquel día sí salió la plata. */
      prisma.movimientoCapital.findMany({
        where: {
          organizationId, referenciaId: { in: idsFaltantes }, createdAt: { gte: inicio, lt: fin },
          OR: [
            { referenciaTipo: 'prestamo', descripcion: { startsWith: 'Reverso desembolso - pr' }, NOT: { descripcion: { contains: 'edici' } } },
            { referenciaTipo: { startsWith: 'prestamo_cancelado' } },
          ],
        },
        select: { referenciaId: true },
      }),
    ])
    const montoPorId = new Map(sueltos.map(p => [p.id, p.montoPrestado || 0]))
    // Borrado o cancelado ese día (la misma marca que usa el libro).
    const anuladosEseDia = new Set(borradosEseDia.map((m) => m.referenciaId))
    for (const id of idsFaltantes) {
      vistos.add(id)
      if (migrados.has(id) || anuladosEseDia.has(id)) continue
      cantidad += 1
      const mov = mapaEntregado.get(id)
      efectivoEntregado += mov ? mov.monto : 0
      valorPrestado += montoPorId.get(id) ?? (mov ? mov.monto : 0)
    }
  }

  return {
    valorPrestado: Math.round(valorPrestado),
    efectivoEntregado: Math.round(efectivoEntregado),
    cantidadPrestamos: cantidad,
  }
}

// Suma el monto de seguros cobrados en el día (prestamos creados con seguro=true).
// El seguro YA viene sumado al total del prestamo; aqui solo se totaliza como
// referencia de "cuanto se gano en seguros" en el cierre del dia.
// Owner (cobradorId null): todos los del dia. Cobrador: los de clientes de su ruta.
export async function calcularSegurosDia(organizationId, inicio, fin, cobradorId = null) {
  const baseWhere = {
    organizationId,
    seguro: true,
    montoSeguro: { gt: 0 },
    createdAt: { gte: inicio, lt: fin },
    estado: { not: 'cancelado' },
  }

  // Vista owner: todos los seguros del dia.
  if (!cobradorId) {
    const r = await prisma.prestamo.aggregate({
      where: baseWhere,
      _sum: { montoSeguro: true },
      _count: true,
    })
    return { monto: Math.round(r._sum?.montoSeguro || 0), cantidad: r._count || 0 }
  }

  // Vista cobrador: prestamos con seguro de (a) clientes de su ruta o (b) creados
  // por el (via actividadLog). Mismo criterio que el desembolsado del dia para
  // que el cuadrito de seguros sea consistente y no deje fuera prestamos que el
  // cobrador hizo a clientes de otra ruta.
  const [porRuta, actividades] = await Promise.all([
    prisma.prestamo.findMany({
      where: { ...baseWhere, cliente: { ruta: { cobradorId } } },
      select: { id: true, montoSeguro: true },
    }),
    prisma.actividadLog.findMany({
      where: { organizationId, userId: cobradorId, accion: 'crear_prestamo', createdAt: { gte: inicio, lt: fin } },
      select: { entidadId: true },
    }),
  ])

  const ids = new Map(porRuta.map(p => [p.id, p.montoSeguro || 0]))
  const idsActividad = actividades.map(a => a.entidadId).filter(Boolean).filter(id => !ids.has(id))
  if (idsActividad.length > 0) {
    const extra = await prisma.prestamo.findMany({
      where: { ...baseWhere, id: { in: idsActividad } },
      select: { id: true, montoSeguro: true },
    })
    for (const p of extra) ids.set(p.id, p.montoSeguro || 0)
  }

  let monto = 0
  for (const v of ids.values()) monto += v
  return { monto: Math.round(monto), cantidad: ids.size }
}

// Calcula estadísticas del día
// verSaldoCaja: si es true (owner siempre, o cobrador con permiso), expone saldoCapitalActual
// como disponibleHoy. Si es false (cobrador sin permiso), usa el flujo operativo del día.
export async function getStatsDia(organizationId, fecha, cobradorId = null, verSaldoCaja = true) {
  // Convertir fecha Colombia a UTC
  const fechaStr = typeof fecha === 'string' ? fecha : fecha.toISOString().slice(0, 10)
  const { inicio, fin } = getDayRange(fechaStr)

  // Obtener pagos del día usando rango UTC correcto.
  // Los pagos de un prestamo clavo SI cuentan en el recaudado/caja: es dinero
  // real que entró y el cobrador debe cuadrarlo. Lo unico que se aisla del clavo
  // es el lado negativo (mora, cuotas vencidas, cartera/esperado) — no los cobros.
  const wherePagos = {
    prestamo: { organizationId, estado: { not: 'cancelado' } },
    fechaPago: { gte: inicio, lt: fin },
    // El abono previo de un migrado no se cobró ese día (abono-previo.js).
    AND: [SIN_ABONO_PREVIO],
  }
  if (cobradorId) {
    /* ⚠ LO SUYO ES SU RUTA, NO SOLO LO QUE TECLEÓ ÉL.
       Esto filtraba `cobradorId` a secas, así que un cobro que hiciera el dueño
       en la ruta de Alex no salía aquí y sí en la ficha de Alex: la misma
       persona, el mismo día, dos cifras. Medido: 132 pagos, $5.444.000 en 7
       días, 5 cobradores.

       `rutaIdsDe` existe justo para esto y su comentario ya describe el fallo.
       Mismo criterio que `caja/cobrador/[id]/route.js:198-204`. */
    const rutasDelCobrador = await rutaIdsDe(organizationId, cobradorId)
    wherePagos.OR = [
      { cobradorId },
      ...(rutasDelCobrador.length ? [{ prestamo: { cliente: { rutaId: { in: rutasDelCobrador } } } }] : []),
    ]
  }

  // ── LO COBRADO, Y EN QUE SE COBRO ──
  //
  // Se pide agregado y separado por medio en la MISMA consulta. Antes se
  // traian las filas y se sumaban en JS, que funciona hasta que un negocio
  // tiene 300 pagos al dia — y el cliente de 10 cobradores los tiene.
  //
  // La separacion efectivo/transferencia no es un adorno: una caja fisica no
  // contiene Nequi. En ese mismo cliente el 12% del recaudo entra por
  // transferencia ($35.261.200 en 736 pagos) y la caja lo cuenta como efectivo,
  // asi que el fajo de la noche no puede cuadrar nunca.
  /* ── ⚠ SE AGRUPA TAMBIÉN POR CUENTA, NO SOLO POR MEDIO ────────────────────
     Antes bastaba `metodoPago` porque TODA transferencia se daba por ajena al
     fajo del cobrador. Desde que cada cuenta dice de quién es (`esDelCobrador`),
     dos transferencias del mismo día pueden ir a lados distintos de la resta.
     Ver el porqué largo en `lib/dinero/cuentas.js`. */
  const [pagosPorMedio, cuentasCobrador] = await Promise.all([
    prisma.pago.groupBy({
      by: ['metodoPago', 'metodoPagoId'],
      where: { ...wherePagos, tipo: { notIn: ['recargo', 'descuento'] } },
      _sum: { montoPagado: true },
    }),
    cuentasDelCobrador(prisma, organizationId),
  ])

  let recogida = 0, recogidaEfectivo = 0, recogidaDigital = 0
  for (const g of pagosPorMedio) {
    const monto = Math.round(g._sum?.montoPagado || 0)
    recogida += monto
    // Lo que no dice nada es efectivo: es el modo por defecto de un cobro en
    // la calle, y descartarlo perdia plata del desglose.
    if (entraAlFajo(g.metodoPago, g.metodoPagoId, cuentasCobrador)) recogidaEfectivo += monto
    else recogidaDigital += monto
  }

  // Calcular esperado real desde las cuotas diarias de préstamos activos
  const esperado = Math.round(await calcularEsperadoReal(organizationId, cobradorId, fechaStr))

  // Obtener gastos del día
  const whereGastosDia = {
    organizationId,
    fecha: { gte: inicio, lt: fin },
    estado: { in: ['pendiente', 'aprobado'] },
  }
  if (cobradorId) whereGastosDia.cobradorId = cobradorId

  const gastosDia = await prisma.gastoMenor.aggregate({
    where: whereGastosDia,
    _sum: { monto: true },
  })

  // Movimientos manuales de caja/capital del día (inyecciones, retiros y ajustes)
  // para reflejar el dinero físico real disponible en caja.
  const movimientosManualDia = cobradorId
    ? []
    : await prisma.movimientoCapital.findMany({
      where: {
        organizationId,
        createdAt: { gte: inicio, lt: fin },
        tipo: { in: ['capital_inicial', 'inyeccion', 'retiro', 'ajuste'] },
        OR: [
          { referenciaTipo: null },
          { referenciaTipo: { in: ['caja_ajuste', 'caja_capital_manual'] } },
        ],
      },
      select: {
        tipo: true,
        monto: true,
        saldoAnterior: true,
        saldoNuevo: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

  // Base inicial del día = saldo de capital justo antes del primer movimiento del día.
  // Si no hubo movimientos hoy, base = saldo actual de capital.
  // Se calcula SIEMPRE (owner y cobrador) porque ahora ambos ven el mismo saldo en caja.
  let baseInicialDia = 0
  let saldoCapitalActual = 0
  const cap = await prisma.capital.findUnique({
    where: { organizationId },
    select: { saldo: true },
  })
  if (cap) {
    saldoCapitalActual = Number(cap.saldo || 0)
    const primerMov = await prisma.movimientoCapital.findFirst({
      where: { organizationId, createdAt: { gte: inicio, lt: fin } },
      orderBy: { createdAt: 'asc' },
      select: { saldoAnterior: true },
    })
    /* ⚠ SE DERIVA DEL SALDO DE VERDAD, NO DE LA PRIMERA FOTO.
     *
     * Decía `primerMov.saldoAnterior`, y esa foto miente en cuanto la cadena
     * del día no es contigua — basta con borrar un movimiento del medio o con
     * que uno entre con la fecha de otro momento. El 27 de agosto de 2026 un
     * prestamista vio TRES cifras distintas en la misma tarjeta por eso.
     *
     * `Capital.saldo` menos lo que se movió hoy es el mismo número cuando la
     * cadena está sana, y el correcto cuando no lo está. Y es el que hace que
     * «con lo que amaneciste» y la cifra grande cuenten la misma historia. */
    const delDia = await prisma.movimientoCapital.findMany({
      where: { organizationId, createdAt: { gte: inicio, lt: fin } },
      select: { saldoAnterior: true, saldoNuevo: true },
    })
    /* La MISMA función que usa `resumirLibro` para derivar su apertura. Un
       `SUM` en la base redondearía el total y no cada delta, y con asientos que
       llevan fracciones de céntimo eso son dos cifras distintas en la misma
       pantalla. */
    baseInicialDia = primerMov ? saldoCapitalActual - loQueSeMovio(delDia) : saldoCapitalActual
  }

  const gastos = gastosDia._sum?.monto || 0
  /* La cifra Y las filas que la componen, del mismo sitio: si la pantalla deja
     abrir «lo que prestaste», la lista tiene que sumar exactamente el número de
     arriba. Calcularlas por separado es como acaban dos cifras que se
     contradicen. */
  const { total: desembolsadoDia, filas: desembolsosDia } =
    await detalleDesembolsadoDia(organizationId, inicio, fin, cobradorId)
  // Aditivo: valor de las cartulinas vs efectivo que salio de la caja. No entra
  // en ningun calculo de saldo, es solo para mostrar los dos numeros separados.
  const prestadoDetalle = await calcularPrestadoDetalleDia(organizationId, inicio, fin, cobradorId)
  const segurosCobradosDia = await calcularSegurosDia(organizationId, inicio, fin, cobradorId)
  const ajustesManualDia = movimientosManualDia.reduce((acc, mov) => {
    if (mov.tipo === 'capital_inicial' || mov.tipo === 'inyeccion') return acc + mov.monto
    if (mov.tipo === 'retiro') return acc - mov.monto
    const esIngreso = mov.saldoNuevo >= mov.saldoAnterior
    return acc + (esIngreso ? mov.monto : -mov.monto)
  }, 0)
  const diferencia = recogida - esperado
  const disponibleOperativo = recogida - gastos
  const saldoRealCaja = disponibleOperativo - desembolsadoDia
  const saldoRealCajaConAjustes = saldoRealCaja + ajustesManualDia
  // Saldo en caja del día.
  // Si `verSaldoCaja` (owner o cobrador con permiso): devuelve saldoCapitalActual
  // (fuente de verdad, refleja TODOS los movimientos). Así cobrador y owner comparten el número.
  // Si NO tiene permiso: devuelve solo el flujo operativo (recogido - prestado - gastos).
  const disponibleHoy = verSaldoCaja
    ? Math.round(saldoCapitalActual)
    : saldoRealCaja
  // Ajustes "operativos" del día = todo lo que cambió capital - cobrado + prestado + gastos.
  // Solo relevante si el usuario tiene permiso para ver el saldo de caja (owner o
  // cobrador con verSaldoCaja); si no, queda en 0 porque el cobrador no ve ese saldo.
  const ajustesOperativosDia = verSaldoCaja
    ? Math.round((saldoCapitalActual - baseInicialDia) - recogida + desembolsadoDia + gastos)
    : 0
  const disponible = disponibleOperativo // Compatibilidad temporal

  // Calcular tasa de recaudo
  const tasaRecaudo = esperado > 0 ? Math.round((recogida / esperado) * 100) : 0

  // ── LA CONCILIACION ──────────────────────────────────────────────────────
  //
  // `ajustesOperativosDia` de arriba es el residuo que hace cuadrar la banda
  // SIEMPRE. Se conserva de momento para no romper la pantalla vieja, pero la
  // cifra que hay que creer es esta: enfrenta el LIBRO contra las OPERACIONES
  // y contra el efectivo contado, y cuando no cuadra LO DICE en vez de
  // absorberlo.
  //
  // Corrida contra 60 dias del cliente de 10 cobradores: 53 con descuadre,
  // 4 cuadrados. La banda vieja decia «cuadra» los 57.
  /* Y los asientos de los préstamos que su caja cuenta como suyos (clientes de
     sus rutas, creados ese día) aunque el asiento haya quedado sin ruta o en
     otra: el libro tiene que mirar lo mismo que las operaciones o la
     conciliación acusa una diferencia que no es plata. */
  const prestamosSuyosDelDia = cobradorId
    ? (await prisma.prestamo.findMany({
      where: { organizationId, createdAt: { gte: inicio, lt: fin }, estado: { not: 'cancelado' }, cliente: { ruta: { cobradorId } } },
      select: { id: true },
    })).map((p) => p.id)
    : []
  const movimientosDia = await prisma.movimientoCapital.findMany({
    where: {
      organizationId,
      createdAt: { gte: inicio, lt: fin },
      ...(cobradorId ? { OR: [
        { creadoPorId: cobradorId },
        { rutaId: { in: await rutaIdsDe(organizationId, cobradorId) } },
        ...(prestamosSuyosDelDia.length ? [{ referenciaTipo: 'prestamo', referenciaId: { in: prestamosSuyosDelDia } }] : []),
      ] } : {}),
    },
    select: {
      /* ⚠ EL `id` VIAJA para poder DESHACER desde la pantalla.
         Un cliente se fue el 16 ago por esto: metió un ajuste manual para
         cuadrar la caja, le borramos el gasto —que asienta su propio reverso—
         y quedó con la caja inflada. Se le dijo «borra los ajustes manuales» y
         no había forma: sin el `id` aquí, la pantalla no puede ni nombrarlos. */
      id: true,
      tipo: true, monto: true, saldoAnterior: true, saldoNuevo: true,
      descripcion: true, metodoPago: true, createdAt: true,
      /* ⚠ `referenciaTipo` HACE FALTA AUNQUE NO SE PINTE.
         `esReversoDeGasto` lo mira para restar de los gastos del día la
         anulación de un gasto. Sin pedirlo llega `undefined`, el predicado no
         acierta NUNCA y el día vuelve a decir «gastos que no cuadran» — sin un
         solo error, con las tarjetas de los asientos perfectas en la base.
         Me pasó al arreglarlo: los asientos estaban bien y la caja seguía rota.
         Es la misma trampa que ya advierte `afectaCaja` con los saldos. */
      referenciaTipo: true,
      /* Y `referenciaId`, que es lo que apunta del reverso a su original: sin
         él no se puede saber cuál ya está deshecho y se ofrecerían otra vez. */
      referenciaId: true,
    },
    orderBy: { createdAt: 'asc' },
  })
  // Qué préstamos de estos asientos son migrados: el libro pone su entrada en
  // su propia línea y no como cobrado o prestado del día.
  const migradosDelLibro = await prestamosMigrados(prisma, movimientosDia
    .filter((m) => m.referenciaTipo === 'prestamo')
    .map((m) => m.referenciaId))

  // ── EL DIA SIN MOVIMIENTOS ──
  //
  // Sin asientos no hay «primer asiento», y la apertura salia en CERO: la
  // pantalla decia «con lo que amaneciste $0» mientras su propio titular, tres
  // centimetros arriba, decia «saldo en caja $3.895.947». Con el resto de la
  // cuenta tambien en cero, el desglose entero contradecia a su encabezado.
  //
  // El calculo correcto YA ESTABA en este archivo: `baseInicialDia` (linea
  // ~812) cae en `saldoCapitalActual` justo cuando no hay primer movimiento.
  // La conciliacion no lo usaba. Es el mismo patron de otras veces: la cifra
  // buena existia al lado y la pantalla leia la mala.
  //
  // ⚠ SOLO CUANDO SE MIRA LA ORGANIZACION ENTERA. Filtrando por cobrador,
  // `saldoCapitalActual` es el saldo de TODO el negocio, no el de su ruta:
  // pasarlo ahi le pintaria al cobrador una apertura que no es suya. En ese
  // caso se queda en null y la apertura vale cero, que es lo que habia.
  const saldoPrevioDelDia = cobradorId ? null : baseInicialDia

  /* Los ajustes que la persona metió A MANO ese día, para que la pantalla
     pueda enseñárselos y ofrecer deshacerlos. Solo esos: un recaudo o un gasto
     se deshacen desde su propia pantalla, con sus propias consecuencias. */
  const yaDeshechos = new Set(movimientosDia
    .filter((m) => m.referenciaTipo === 'caja_ajuste_reverso')
    .map((m) => m.referenciaId))
  const ajustesManuales = movimientosDia
    .filter((m) => ['caja_ajuste', 'caja_capital_manual'].includes(m.referenciaTipo))
    .filter((m) => !yaDeshechos.has(m.id))
    .map((m) => ({
      id: m.id,
      monto: m.monto,
      suma: m.saldoNuevo > m.saldoAnterior,
      descripcion: m.descripcion,
      createdAt: m.createdAt,
    }))
  const conciliacion = conciliar({
    alcance: cobradorId ? ALCANCE.COBRADOR : ALCANCE.ORGANIZACION,
    /* El tercer argumento es el punto de llegada. Solo en la vista del NEGOCIO:
       en la de un cobrador los asientos vienen filtrados por sus rutas y
       `Capital.saldo` es el de todos, así que derivar le achacaría a él lo que
       movieron las demás. Ver la nota larga en `resumirLibro`. */
    libro: resumirLibro(movimientosDia, saldoPrevioDelDia, cobradorId ? null : saldoCapitalActual, { migrados: migradosDelLibro }),
    operaciones: {
      pagos: recogida,
      pagosEfectivo: recogidaEfectivo,
      pagosDigital: recogidaDigital,
      gastos,
      // EL EFECTIVO QUE DE VERDAD SALIO, no el valor nominal de los prestamos.
      // `desembolsadoDia` suma `montoPrestado` crudo, asi que en una renovacion
      // resta de la caja un dinero que nunca salio: el saldo viejo que se
      // absorbe. Medido en produccion: 765 renovaciones, $132.339.683 de
      // inflado. El calculo bueno ya existia en este archivo y la pantalla
      // usaba el malo.
      desembolsos: prestadoDetalle.efectivoEntregado,
    },
    esperado: { esperado, atrasado: 0 },
  })

  return {
    esperado,
    recogida,
    recogidaEfectivo,
    recogidaDigital,
    conciliacion,
    // Para que la pantalla pueda ofrecer «deshacer» lo que se metió a mano.
    ajustesManuales,
    gastos,
    desembolsadoDia,
    // Con qué se compone: el dueño no podía comprobar el número y tuvo que
    // escribir a soporte para saber de dónde salía.
    desembolsosDia,
    /* ⚠ LO PRESTADO EN BILLETES, aparte del total.
       Un desembolso por transferencia no sale del fajo del cobrador. La tarjeta
       que ve el administrador ya separaba las dos —«Prestó en efectivo»— y la
       caja del propio cobrador no. Ver la nota de `enLaMano` en la pantalla. */
    efectivoPrestadoDia: Math.round(
      (desembolsosDia ?? [])
        .filter((d) => entraAlFajo(d.metodoPago, d.metodoPagoId, cuentasCobrador))
        .reduce((a, d) => a + (d.monto || 0), 0)
    ),
    /* ── ⚠ LO QUE EL DUEÑO LE METIÓ O LE SACÓ HOY, EN BILLETES ──────────────
       Comparadas las dos cajas de PRESTA MIL con los datos del 20 ago, tres de
       los diez cobradores no cuadraban, y las tres diferencias eran esto al
       peso:

           CAMILO   retiro «vase»     $373.000  →  difería en  373.000
           DIEGO    inyección «vase»  $101.000  →  difería en −101.000
           JULIAN   inyección «vase»  $109.000  →  difería en −109.000

       El administrador ya lo contaba —«Le metiste a esta ruta» / «Le sacaste a
       esta ruta»— y la caja del cobrador no. Si al cobrador le meten $109.000
       durante el día, tiene $109.000 más que entregar y su pantalla no se lo
       decía.

       Solo EFECTIVO, y solo de sus rutas: una inyección por transferencia no le
       llena el bolsillo. Los `ajuste` se quedan fuera a propósito — los
       manuales ya los lleva `ajustesManualDia` y los del sistema no son
       billetes. */
    movidoPorElDuenoEfectivo: Math.round(
      (movimientosDia ?? [])
        .filter((m) => ['inyeccion', 'capital_inicial', 'retiro'].includes(m.tipo))
        .filter((m) => m.metodoPago !== 'transferencia')
        .reduce((a, m) => a + (m.tipo === 'retiro' ? -(m.monto || 0) : (m.monto || 0)), 0)
    ),
    // Dos cifras distintas del dia (se separan en renovaciones):
    valorPrestadoDia: prestadoDetalle.valorPrestado,
    efectivoEntregadoDia: prestadoDetalle.efectivoEntregado,
    cantidadPrestamosDia: prestadoDetalle.cantidadPrestamos,
    diferencia,
    disponibleOperativo,
    saldoRealCaja,
    ajustesManualDia,
    saldoRealCajaConAjustes,
    baseInicialDia: Math.round(baseInicialDia),
    ajustesOperativosDia,
    disponibleHoy,
    disponible,
    tasaRecaudo,
    segurosCobradosDia,
  }
}
