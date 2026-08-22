// app/api/prestamos/route.js

import { getServerSession }    from 'next-auth'
import { authOptions }         from '@/lib/auth'
import { prisma }              from '@/lib/prisma'
import {
  fechaDePeriodo,
  calcularPrestamo,
  calcularDiasMora,
  calcularMontoEnMora,
  calcularSaldoPendiente,
  calcularPorcentajePagado,
  calcularCapitalRestante,
  calcularProximoCobro,
  calcularCuotasPendientes,
  tieneTablaAmortizacion,
  pagoHoy,
  prestamoDevuelveMenosDeLoPrestado,
  mensajePrestamoConPerdida,
} from '@/lib/calculos'
import { obtenerDiasSinCobro } from '@/lib/dias-sin-cobro'
import { registrarMovimientoCapital } from '@/lib/capital'
import { logActividad } from '@/lib/activity-log'
import { trackEvent } from '@/lib/analytics'
import { refrescarTotalesPrestamo } from '@/lib/prisma-pago-helpers'
import { devengarAlCrear } from '@/lib/dinero/devengar'
import { getLocalDateStr, inicioDelDiaLocal } from '@/lib/i18n'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { rutaPermitida } from '@/lib/limites-plan'
import { enviarPushOrg } from '@/lib/push'

// ─── GET /api/prestamos ─────────────────────────────────────────
export async function GET(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { organizationId, rol, rutaIds = [] } = session.user
  const { searchParams } = new URL(request.url)
  const clienteId = searchParams.get('clienteId')
  const estado    = searchParams.get('estado')
  const frecuenciaRaw = searchParams.get('frecuencia')
  const frecuencia = ['diario', 'semanal', 'quincenal', 'mensual'].includes(frecuenciaRaw) ? frecuenciaRaw : null
  const buscar    = searchParams.get('buscar')?.trim()
  const rutaId    = searchParams.get('rutaId')
  const creadoPorId = searchParams.get('creadoPorId')
  const renovacion = searchParams.get('renovacion') // 'si' | 'no' | null
  const modoInteres = searchParams.get('modoInteres')
  // Prestamos activos sin pagos hace N dias. Existe para que la alerta
  // "N prestamos sin pagos hace mas de 7 dias" del dashboard tenga a donde
  // llevar: antes enlazaba a /prestamos pelado y caias al listado completo.
  // Dos filtros que YO ya enlazaba desde el panel («N prestamos con mas de 30
  // dias de mora» y «N listos para renovar») y que el endpoint NO entendia: los
  // enlaces existian y no filtraban nada. Cuarta vez el patron del control
  // muerto, esta vez de mi propia mano y en la misma sesion.
  const diasMoraMinRaw = Number(searchParams.get('diasMoraMin'))
  const diasMoraMin = Number.isFinite(diasMoraMinRaw) && diasMoraMinRaw > 0
    ? Math.min(diasMoraMinRaw, 3650)
    : null
  const listosRenovar = searchParams.get('listosRenovar') === '1'

  const sinPagosDiasRaw = Number(searchParams.get('sinPagosDias'))
  const sinPagosDias = Number.isFinite(sinPagosDiasRaw) && sinPagosDiasRaw > 0
    ? Math.min(sinPagosDiasRaw, 365)
    : null
  const page      = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit     = Math.min(Number(searchParams.get('limit')) || 50, 100)
  // "En mora" no es un estado en BD: sale de calcularDiasMora, que corre en JS
  // (depende de dias sin cobro, festivos y la tabla de amortizacion). Antes la
  // lista pedia una PAGINA de activos y filtraba por mora en el navegador, asi
  // que solo veias los morosos que cayeran en esa pagina: con 97 prestamos en 2
  // paginas, los de la pagina 2 eran invisibles — y el contador, calculado sobre
  // el mismo arreglo ya filtrado, mentia igual. Con soloMora el filtro se evalua
  // en el server sobre TODOS los activos y despues se pagina el resultado.
  const soloMora  = searchParams.get('soloMora') === '1'

  /* ── LOS DOS QUE FALTABAN ────────────────────────────────────────────────
     Reportados por el dueño: «no hay un filtro claro para los préstamos clavos
     dentro del apartado de préstamos […] tampoco hay un filtro claro de nuevos
     préstamos». No estaban ni escondidos: no existían.

     Los dos son columnas, así que se filtran en SQL y la paginación sigue
     siendo cierta.

     ── ⚠ «DE HOY» ES LA JORNADA, NO UNA VENTANA DE 24 HORAS ──
     Lo escribí primero a 24 horas —la misma definición que la pastilla «Nuevo»
     de la tarjeta— y el dueño lo cuestionó. Tiene razón, y el motivo es de
     cuadre, no de gusto:

     TODO lo demás de esta app es un día —la caja, el cierre, «recaudado hoy»,
     «cobrar hoy»— y todos corren de 05:00Z a 05:00Z. Con una ventana móvil, a
     las 9 de la mañana el filtro enseñaría desde las 9 de ayer: preguntas
     «¿cuántos préstamos salieron hoy?», el filtro dice 7 y la caja dice 5
     desembolsos. Dos números para lo mismo, que en esta app ya ha costado caro.

     La PASTILLA de la tarjeta se queda en 24 horas a propósito, y por eso el
     chip se llama «De hoy» y no «Nuevos»: la pastilla dice «recién creado» —ahí
     manda que dure lo mismo para todos, o uno metido a las 23:50 deja de ser
     nuevo diez minutos después— y el chip dice «entró en esta jornada». Son dos
     preguntas distintas y el nombre lo dice. */
  const soloClavos = searchParams.get('clavo') === '1'
  const soloNuevos = searchParams.get('nuevos') === '1'

  /* ══ LOS QUE VENCEN PRONTO ═══════════════════════════════════════════════
   *
   * Pedido por Miguel Ángel (Préstamos Rincón) por el banner de sugerencias:
   *
   *   «Los filtros que más se usan son los de próximos a vencer, bien sea en 5
   *    días o 10 días. Esta aplicación no tiene ese filtro, tiene otros pero no
   *    son los adecuados. O que automáticamente los primeros préstamos en la
   *    lista sean los más cercanos a vencer.»
   *
   * Tenía razón: los chips eran Todos · Pendientes · Activos · En mora ·
   * Renovar · Perdidos · De hoy · Completados · Cancelados. Ninguno contesta
   * «¿a quién tengo que llamar esta semana?».
   *
   * ⚠ SIN LOS QUE YA ESTÁN EN MORA. Vencido no es «por vencer», y «En mora» es
   *   el chip de al lado: si los dos trajeran lo mismo, uno de los dos sobra.
   *   Aquí se contesta lo que todavía se puede evitar.
   *
   * La fecha sale de `calcularProximoCobro`, que es la única que manda en toda
   * la app — la misma que pinta la ficha y la que agrupa la ruta. */
  /* ── A QUIÉN LE TOCA COBRAR, Y CUÁNDO ──────────────────────────────────
   *
   * `porVencer=N` = «los que vencen de aquí a N días». Estaba, pero solo
   * aceptaba 5 y 10, y solo se ofrecían esos dos chips.
   *
   * El dueño lo pidió más ancho: «si el cliente quiere saber a quién le toca
   * cobrar mañana, o en un rango de tiempo, o a quién le tiene que cobrar en 7
   * días, en los próximos 15 días… así no puede filtrar».
   *
   * ⚠ «MAÑANA» NO ES «DE AQUÍ A UN DÍA». Con un solo número no se puede pedir
   * un día suelto: `porVencer=1` trae los de hoy Y los de mañana. Por eso ahora
   * hay DOS extremos, y «mañana» es 1 a 1. Sin `porVencerDesde` el borde de
   * abajo es 0, así que las llamadas viejas —y los dos chips de siempre—
   * siguen dando exactamente lo mismo. */
  const nPorVencer = Number(searchParams.get('porVencer'))
  const porVencer = Number.isInteger(nPorVencer) && nPorVencer >= 0 && nPorVencer <= 90
    ? nPorVencer
    : null
  const nDesde = Number(searchParams.get('porVencerDesde'))
  const porVencerDesde = Number.isInteger(nDesde) && nDesde >= 0 && nDesde <= 90 ? nDesde : 0

  // Cobrador sin ruta asignada no ve nada (previene fuga de datos multi-tenant)
  if (rol === 'cobrador' && rutaIds.length === 0) {
    return Response.json(page != null ? { prestamos: [], total: 0, page, totalPages: 0 } : [])
  }

  const clienteWhere = {
    ...(rol === 'cobrador' && { rutaId: { in: rutaIds } }),
    ...(rutaId && { rutaId }),
    ...(buscar && {
      OR: [
        { nombre: { contains: buscar } },
        { cedula: { contains: buscar } },
      ],
    }),
  }
  const where = {
    organizationId,
    ...(clienteId && { clienteId }),
    ...(estado    ? { estado } : rol === 'cobrador' ? { estado: { not: 'pendiente_aprobacion' } } : {}),
    // Solo un prestamo activo puede estar en mora. Se fuerza aqui para que el
    // filtro sea correcto aunque el llamador no mande estado.
    ...(soloMora && { estado: 'activo' }),
    ...(frecuencia && { frecuencia }),
    ...(creadoPorId && { creadoPorId }),
    ...(renovacion === 'si' && { renovadoDeId: { not: null } }),
    ...(renovacion === 'no' && { renovadoDeId: null }),
    ...(modoInteres && { modoInteres }),
    ...(soloClavos && { esClavo: true }),
    ...(soloNuevos && { createdAt: { gte: inicioDelDiaLocal(session.user.country ?? 'co') } }),
    // MISMA definicion que usa el dashboard para contar la alerta, para que el
    // numero que ves arriba y la lista que abres coincidan. Usa el campo
    // denormalizado ultimoPagoAt (tiene indice con estado) en vez de subqueries
    // sobre pagos, que son caras a escala. `null` = nunca ha pagado.
    ...(sinPagosDias && {
      estado: 'activo',
      OR: [
        { ultimoPagoAt: null },
        { ultimoPagoAt: { lt: new Date(Date.now() - sinPagosDias * 24 * 60 * 60 * 1000) } },
      ],
    }),
    ...(Object.keys(clienteWhere).length > 0 && { cliente: clienteWhere }),
  }

  const prestamos = await prisma.prestamo.findMany({
    where,
    include: {
      cliente: { select: { id: true, nombre: true, cedula: true, telefono: true, fotoUrl: true, rutaId: true, diasSinCobro: true, ruta: { select: { id: true, nombre: true, diasSinCobro: true } } } },
      // Solo los ultimos 10 pagos: suficiente para pagoHoy y calcularCapitalRestante.
      // El totalPagado real se lee del campo denormalizado del prestamo.
      pagos: {
        take: 10,
        orderBy: { fechaPago: 'desc' },
        select: { id: true, montoPagado: true, fechaPago: true, tipo: true },
      },
      /* ⚠ SIN ESTO UN PRÉSTAMO ABIERTO SALE «AL DÍA» SIEMPRE: su mora es el
         interés devengado sin pagar, y un campo que no se pide vale `undefined`
         —no da error, decide en silencio—. Ver lib/dinero/devengar.js. */
      devengos: { select: { periodo: true, interes: true } },
      cuotasAmortizacion: {
        orderBy: { numeroPeriodo: 'asc' },
        select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
      },
    },
    orderBy: [
      { createdAt: 'desc' },
    ],
    // Con soloMora no se pagina en SQL: hay que calcular la mora de todos los
    // activos antes de saber cuales entran. Se pagina abajo, ya filtrado. Es el
    // mismo costo que /api/mora, que tambien recorre todos los activos.
    ...(page != null && !soloMora && { take: limit, skip: (page - 1) * limit }),
  })

  // Config org para días sin cobro + festivos
  const [org, festivos] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { diasSinCobro: true },
    }),
    prisma.festivo.findMany({
      where: { organizationId },
      select: { fecha: true },
    }),
  ])

  // Lookup de nombres de creadores para auditoría
  const creadorIds = [...new Set(prestamos.map(p => p.creadoPorId).filter(Boolean))]
  const creadoresMap = new Map()
  if (creadorIds.length > 0) {
    const users = await prisma.user.findMany({
      where: { id: { in: creadorIds } },
      select: { id: true, nombre: true },
    })
    users.forEach(u => creadoresMap.set(u.id, u.nombre))
  }

  // Cachear diasExcluidos por cliente: el calculo es identico para todos
  // los prestamos del mismo cliente, asi que se hace una sola vez.
  const diasExcluidosCache = new Map()
  const getDiasExcluidos = (cliente) => {
    const key = cliente?.id
    if (!key) return obtenerDiasSinCobro(cliente, cliente?.ruta, org)
    if (!diasExcluidosCache.has(key)) {
      diasExcluidosCache.set(key, obtenerDiasSinCobro(cliente, cliente?.ruta, org))
    }
    return diasExcluidosCache.get(key)
  }

  const resultado = prestamos.map((p) => {
    const diasExcluidos = getDiasExcluidos(p.cliente)
    return {
    id:               p.id,
    clienteId:        p.clienteId,
    cliente:          p.cliente,
    creadoPorId:      p.creadoPorId,
    creadoPorNombre:  creadoresMap.get(p.creadoPorId) || null,
    renovadoDeId:     p.renovadoDeId,
    montoPrestado:    p.montoPrestado,
    totalAPagar:      p.totalAPagar,
    cuotaDiaria:      p.cuotaDiaria,
    frecuencia:       p.frecuencia,
    diaCobroSemana:   p.diaCobroSemana,
    diaCobroMes:      p.diaCobroMes,
    diaCobroMes2:     p.diaCobroMes2,
    tasaInteres:      p.tasaInteres,
    diasPlazo:        p.diasPlazo,
    fechaInicio:      p.fechaInicio,
    fechaFin:         p.fechaFin,
    estado:           p.estado,
    modoInteres:      p.modoInteres,
    /* ⚠ LAS FILAS VIAJAN, y antes no.
     *
     * Se pedían a Prisma para las cuentas del servidor y NO se devolvían: la
     * respuesta es una lista blanca de campos y esta faltaba. La hoja de pago
     * las necesita —`elInteresSubeLaDeuda` no puede decidir sin ellas y
     * REVIENTA a propósito en vez de adivinar—, así que el cobro rápido de un
     * préstamo con tabla se abría en una pantalla de error y el prestamista se
     * quedaba sin poder cobrarle a su cliente.
     *
     * Visto en los registros de producción el 17 ago: el préstamo del error
     * tenía sus 8 filas en la base y se había creado ese mismo día. O sea que
     * no era dato incompleto, era este `select`. Aparece también el 4 y el 10
     * de agosto: llevaba dos semanas.
     *
     * En los modos sin tabla llega `[]`, que también vale: la guardia solo
     * salta con `undefined`, que es «no me las pidieron». */
    cuotasAmortizacion: p.cuotasAmortizacion,
    createdAt:        p.createdAt,
    ultimoPagoAt:     p.ultimoPagoAt,
    // Usa el campo denormalizado (mantenido por refrescarTotalesPrestamo).
    totalPagado:      p.totalPagado ?? 0,
    saldoPendiente:   calcularSaldoPendiente(p),
    porcentajePagado: calcularPorcentajePagado(p),
    capitalRestante:  calcularCapitalRestante(p),
    diasMora:         calcularDiasMora(p, diasExcluidos, festivos),
    // ── LA TIRA DE CIFRAS DE T03-04 ──
    // «ATRASO» en PLATA, no en dias. La tarjeta ya dice «36d» en la pastilla; lo
    // que el dueño decide con ello es cuanto le deben de mas, y eso son pesos.
    // Se calcula aca porque `calcularMontoEnMora` necesita los dias excluidos y
    // los festivos de la organizacion, que el navegador no tiene.
    montoEnMora:      calcularMontoEnMora(p, diasExcluidos, festivos),
    // «cuota 13 de 24», que es lo que T02-06 pone en la linea de contexto.
    //
    // Se calcula ACA y no en el adaptador porque `calcularCuotasPendientes` sabe
    // distinguir los modos CON tabla de amortizacion de los que no: en los que
    // la tienen, la cuota varia y dividir el total por la cuota da un numero
    // equivocado. Es el 6,2% de la cartera, pero es justo donde el error no se
    // notaria al mirar.
    cuotasPendientes: calcularCuotasPendientes(p),
    /* ⚠ UN ABIERTO NO TIENE CUOTAS, Y EL NÚMERO CRECÍA SOLO.
       Reportado por Rhoders con la captura: «cuota 11/11» en un préstamo recién
       creado y sin un solo pago. Sale de `total ÷ cuota` —759.000 ÷ 69.000— así
       que cada mes que devenga interés inventa una cuota más: era 10/10 el día
       anterior. En un préstamo sin plazo no hay última cuota que contar, y con
       0 la tarjeta enseña solo el porcentaje. */
    totalCuotas:      p.sinPlazo && p.modoInteres === 'solo_interes' ? 0
      : tieneTablaAmortizacion(p)
        ? p.cuotasAmortizacion.length
        : (p.cuotaDiaria > 0 ? Math.ceil((p.totalAPagar || 0) / p.cuotaDiaria) : 0),
    esClavo:          p.esClavo,
    pagoHoy:          pagoHoy(p),
    proximoCobro:     calcularProximoCobro(p, diasExcluidos, festivos),
  }})

  // Orden cronologico puro: prestamo mas nuevo arriba (ya viene del Prisma orderBy).
  // El cliente que quiera ver los prestamos agrupados por persona usa el filtro
  // "Agrupar por cliente" en el frontend, que reordena ahi.

  // Filtros que dependen de algo YA CALCULADO en JS —dias de mora, porcentaje
  // pagado— asi que no pueden ir en el `where` de Prisma. Se aplican aqui y
  // recien despues se pagina, para que el total y la lista cubran TODA la cartera
  // y no la pagina que toco cargar.
  //
  // `listosRenovar`: al dia Y por encima del 80% pagado. Es el mejor momento
  // para prestar de nuevo, y de ahi sale el crecimiento del negocio. Mismo
  // umbral que usa el panel para contarlos, para que el numero de la fila y el
  // largo de la lista coincidan.
  const RENOVAR_DESDE = 80
  // El arranque del día del país, el mismo que usa «De hoy»: si se midiera desde
  // «ahora», un cobro de esta tarde saldría con cero días y mañana con menos uno.
  const inicioHoy = inicioDelDiaLocal(session.user.country ?? 'co')
  const criterio = soloMora ? ((p) => p.diasMora > 0)
    // MAS DE N, no «N o mas». Todas las etiquetas del producto dicen «mas de 30
    // dias» —la fila del panel, las opciones de la hoja— y el contador del panel
    // usa `> 30`. Con `>=` la lista traia 3 donde la fila decia 2: el mismo
    // numero con dos umbrales, que es el defecto que ya corregi una vez en los
    // avisos (7 dias contra 15). Un solo criterio, escrito donde se aplica.
    // Y SIN CLAVOS. El contador del panel excluye `esClavo` y la lista no, asi
    // que la fila decia 2 y la lista traia 3. Un clavo esta por definicion en
    // mora larga, ya se clasifico como perdido y vive en su propia pantalla:
    // volver a alarmar sobre algo ya decidido es ruido, y encima hace que el
    // numero de la fila no cuadre con lo que se abre al tocarla.
    //
    // Solo se excluye de ESTE filtro. En la lista normal los clavos siguen
    // estando: se les sigue cobrando.
    : diasMoraMin != null ? ((p) => p.diasMora > diasMoraMin && !p.esClavo)
    : listosRenovar ? ((p) => p.estado === 'activo' && p.diasMora === 0 && p.porcentajePagado >= RENOVAR_DESDE)
    /* Vivo, sin mora, y con su próximo cobro dentro de la ventana. El corte de
       «hoy» va con el convenio de la casa —el día arranca a las 05:00Z— para que
       un cobro de esta tarde no se caiga de la lista por el huso del servidor. */
    : porVencer != null ? ((p) => {
      if (p.estado !== 'activo' || p.diasMora > 0 || !p.proximoCobro) return false
      const dias = Math.ceil((new Date(p.proximoCobro) - inicioHoy) / 86400000)
      return dias >= porVencerDesde && dias <= porVencer
    })
    : null

  if (criterio) {
    let filtrados = resultado.filter(criterio)
    /* «Que automáticamente los primeros préstamos en la lista sean los más
       cercanos a vencer» — es la segunda mitad de lo que pidió, y sin ella el
       filtro obliga a leer veinte fechas para encontrar la de mañana. */
    if (porVencer != null) {
      filtrados = [...filtrados].sort((a, b) => new Date(a.proximoCobro) - new Date(b.proximoCobro))
    }
    if (page != null) {
      const desde = (page - 1) * limit
      return Response.json({
        prestamos: filtrados.slice(desde, desde + limit),
        total: filtrados.length,
        page,
        totalPages: Math.max(1, Math.ceil(filtrados.length / limit)),
      })
    }
    return Response.json(filtrados)
  }

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    const total = await prisma.prestamo.count({ where })
    return Response.json({ prestamos: resultado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(resultado)
  } catch (err) {
    console.error('[GET /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/prestamos ────────────────────────────────────────
export async function POST(request) {
  let faltanteCapital = 0
  let saldoCapitalActual = 0
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeCrearPrestamos: true },
      })
      if (!cobrador?.puedeCrearPrestamos) {
        return Response.json({ error: 'No tienes permiso para crear préstamos' }, { status: 403 })
      }
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { organizationId, rol } = session.user
  const body = await request.json()
  const { clienteId, montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia, yaAbonado, cuotaManual, inyeccionPrevia, diaCobroSemana, diaCobroMes, diaCobroMes2, seguro, montoSeguro, modoInteres, nombreProducto, interesAdelantado, capitalExtra, socioId, sinPlazo, metodoPago: metodoPagoDesembolso, metodoPagoId: metodoPagoIdDesembolso } = body
  // Cuenta de la que sale el desembolso (para el desglose por cuenta). Si no
  // viene, se asume efectivo (el caso mas comun en gota a gota).
  const cuentaDesembolso = metodoPagoDesembolso || 'efectivo'
  const cuentaDesembolsoId = metodoPagoDesembolso === 'transferencia' ? (metodoPagoIdDesembolso || null) : null

  const freq = frecuencia || 'diario'
  const frecuenciasValidas = ['diario', 'semanal', 'quincenal', 'mensual']
  if (!frecuenciasValidas.includes(freq)) {
    return Response.json({ error: 'Frecuencia no válida' }, { status: 400 })
  }

  // Dia ancla: semanal/quincenal usa diaCobroSemana (0-6), mensual usa diaCobroMes (1-31).
  // Ambos son opcionales. Se ignoran para frecuencias que no aplican.
  let diaCobroSemanaDb = null
  let diaCobroMesDb = null
  let diaCobroMes2Db = null
  if ((freq === 'semanal' || freq === 'quincenal') && diaCobroSemana != null && diaCobroSemana !== '') {
    const v = Number(diaCobroSemana)
    if (!Number.isInteger(v) || v < 0 || v > 6) {
      return Response.json({ error: 'Día de la semana inválido (0-6)' }, { status: 400 })
    }
    diaCobroSemanaDb = v
  }
  if ((freq === 'mensual' || freq === 'quincenal') && diaCobroMes != null && diaCobroMes !== '') {
    const v = Number(diaCobroMes)
    if (!Number.isInteger(v) || v < 1 || v > 31) {
      return Response.json({ error: 'Día del mes inválido (1-31)' }, { status: 400 })
    }
    diaCobroMesDb = v
  }
  if (freq === 'quincenal' && diaCobroMes2 != null && diaCobroMes2 !== '') {
    const v = Number(diaCobroMes2)
    if (!Number.isInteger(v) || v < 1 || v > 31) {
      return Response.json({ error: 'Segundo día del mes inválido (1-31)' }, { status: 400 })
    }
    diaCobroMes2Db = v
  }

  // Validaciones
  if (!clienteId)     return Response.json({ error: 'El cliente es requerido' },          { status: 400 })
  if (!montoPrestado) return Response.json({ error: 'El monto es requerido' },            { status: 400 })
  if (tasaInteres == null || tasaInteres === '') return Response.json({ error: 'La tasa de interés es requerida' }, { status: 400 })
  /* ⚠ EL PLAZO DEJA DE SER OBLIGATORIO EN UN ABIERTO, y solo ahí. Es el
     requisito que trajo el cliente nuevo —«probé GLOBO pero me exige un plazo y
     una fecha final, y mi modelo no funciona así»— y la razón de existir de
     todo esto. En los siete modos restantes se sigue exigiendo igual. */
  const pideAbierto = modoInteres === 'solo_interes' && !!sinPlazo
  if (!diasPlazo && !pideAbierto) return Response.json({ error: 'El plazo es requerido' }, { status: 400 })
  if (!fechaInicio)   return Response.json({ error: 'La fecha de inicio es requerida' },  { status: 400 })

  // Bloquear fechas futuras: si el cobrador se equivoca con la fecha el prestamo
  // no aparece en cobro hasta esa fecha (bug silencioso). Comparamos en zona horaria del usuario.
  const hoyLocal = getLocalDateStr(session.user.country ?? 'co')
  if (typeof fechaInicio === 'string' && fechaInicio > hoyLocal) {
    return Response.json({ error: 'La fecha de inicio no puede ser futura' }, { status: 400 })
  }

  if (Number(montoPrestado) <= 0) return Response.json({ error: 'El monto debe ser mayor a 0' }, { status: 400 })
  if (Number(tasaInteres)   < 0)  return Response.json({ error: 'La tasa no puede ser negativa' },  { status: 400 })
  if (Number(diasPlazo)     <= 0) return Response.json({ error: 'El plazo debe ser mayor a 0' }, { status: 400 })
  const abono = Number(yaAbonado) || 0
  if (abono < 0) return Response.json({ error: 'El abono no puede ser negativo' }, { status: 400 })

  // Verificar que el cliente pertenece a la organización
  const cliente = await prisma.cliente.findFirst({
    where: { id: clienteId, organizationId },
  })
  if (!cliente) return Response.json({ error: 'Cliente no encontrado' }, { status: 404 })

  if (cliente.rutaId && !await rutaPermitida(organizationId, cliente.rutaId)) {
    return Response.json({ error: 'La ruta de este cliente excede el limite de tu plan. Mejora tu plan o desactiva rutas que no uses.' }, { status: 403 })
  }

  if (cliente.montoMaximoPrestamo && Number(montoPrestado) > cliente.montoMaximoPrestamo) {
    return Response.json({
      error: `El monto supera el tope de este cliente (${Math.round(cliente.montoMaximoPrestamo).toLocaleString('es-CO')})`,
    }, { status: 400 })
  }

  // El cobrador puede crear préstamos a clientes de cualquiera de sus rutas
  // asignadas (consistente con GET /api/prestamos que ya filtra por rutaIds[]).
  if (rol === 'cobrador') {
    const rutasAsignadas = await prisma.ruta.findMany({
      where: { organizationId, cobradorId: session.user.id, activo: true },
      select: { id: true },
    })

    if (rutasAsignadas.length === 0) {
      return Response.json({ error: 'No tienes una ruta activa asignada' }, { status: 400 })
    }

    const rutaIdsAsignadas = rutasAsignadas.map(r => r.id)
    if (!cliente.rutaId) {
      if (rutaIdsAsignadas.length === 1) {
        await prisma.cliente.update({
          where: { id: clienteId },
          data: { rutaId: rutaIdsAsignadas[0] },
        })
        cliente.rutaId = rutaIdsAsignadas[0]
      } else {
        return Response.json({ error: 'Este cliente no tiene ruta asignada. Asignale una ruta antes de crear el préstamo.' }, { status: 400 })
      }
    } else if (!rutaIdsAsignadas.includes(cliente.rutaId)) {
      return Response.json({ error: 'Solo puedes crear préstamos para clientes de tus rutas asignadas' }, { status: 403 })
    }
  }

  // Ruta a la que se atribuyen los movimientos de capital (sub-bolsa por ruta).
  const rutaIdCapital = cliente.rutaId || null

  // Calcular valores del préstamo (cuotaManual opcional sobreescribe la cuota calculada)
  const cuotaManualNum = Number(cuotaManual) || 0
  if (cuotaManualNum < 0) {
    return Response.json({ error: 'La cuota manual no puede ser negativa' }, { status: 400 })
  }
  // Validar modo de interes; si viene cuotaManual el calculo lo trata como manual.
  const modoValido = ['fijo', 'unico', 'saldo', 'manual', 'lineal', 'solo_interes', 'lineal_dinamico'].includes(modoInteres) ? modoInteres : 'fijo'

  /* ══ PRÉSTAMO ABIERTO ══════════════════════════════════════════════════════
   * Solo en Globo. La bandera no se «cree» venga de donde venga: si llega en
   * cualquier otro modo se ignora, y así el radio de impacto de todo esto es un
   * modo y no la app. Es lo mismo que hace `calcularPrestamo`, y va en los dos
   * sitios a propósito: la pantalla no es una frontera de confianza. */
  const esAbierto = modoValido === 'solo_interes' && !!sinPlazo

  /* ⚠ SIN DÍA DE CORTE EN LOS ABIERTOS, DE MOMENTO. El día de corte prorratea
   * el primer período, y ese prorrateo todavía no está fijado por una prueba
   * para el devengo. Antes que dejarlo pasar y cobrar de más el primer mes, se
   * ignora: el primer período es un período entero desde que se entregó. */
  if (esAbierto && (diaCobroMes || diaCobroMes2)) {
    return Response.json({
      error: 'Un préstamo abierto todavía no admite día de corte fijo. Quita el día de corte o ponle un plazo.',
    }, { status: 400 })
  }

  const calc = calcularPrestamo({
    ...(esAbierto && { sinPlazo: true }),
    montoPrestado, tasaInteres, diasPlazo, fechaInicio, frecuencia: freq, modoInteres: modoValido,
    ...(cuotaManualNum > 0 && { cuotaManual: cuotaManualNum }),
    interesAdelantado: modoValido === 'solo_interes' && !!interesAdelantado,
    ...(Array.isArray(capitalExtra) && capitalExtra.length > 0 && { capitalExtra }),
    diaCobroMes: diaCobroMesDb,
    diaCobroMes2: diaCobroMes2Db,
  })
  // Sobre saldo con una cuota que no cubre ni el interes del primer periodo: el
  // prestamo no amortiza nunca y la tabla degenera en un globo gigante. Se corta
  // aca con los numeros que el prestamista necesita para corregir.
  if (calc.cuotaInsuficiente) {
    return Response.json({
      error: `Esa cuota no alcanza a cubrir el interés. El primer período genera $${calc.interesPrimerPeriodo.toLocaleString('es-CO')} de interés, así que con una cuota menor la deuda nunca baja. Cuota mínima: $${calc.cuotaMinima.toLocaleString('es-CO')}. Para terminar de pagar en el plazo elegido: $${calc.cuotaSugerida.toLocaleString('es-CO')}.`,
      cuotaInsuficiente: true,
      interesPrimerPeriodo: calc.interesPrimerPeriodo,
      cuotaMinima: calc.cuotaMinima,
      cuotaSugerida: calc.cuotaSugerida,
    }, { status: 400 })
  }

  if (prestamoDevuelveMenosDeLoPrestado({ totalAPagar: calc.totalAPagar, montoPrestado })) {
    return Response.json({
      error: mensajePrestamoConPerdida({
        totalAPagar: calc.totalAPagar, montoPrestado,
        numPeriodos: calc.numPeriodos, frecuencia,
      }),
      prestamoConPerdida: true,
      totalAPagar: calc.totalAPagar,
      montoPrestado,
      numPeriodos: calc.numPeriodos,
    }, { status: 400 })
  }

  const { totalAPagar, cuotaDiaria, fechaFin: fechaFinCalc } = calc
  /* En un abierto, el «fin» es el primer corte de interés. Ver la nota de
     `diasPlazo` más abajo. */
  const fechaFin = esAbierto
    ? fechaDePeriodo(1, {
        fechaInicio: new Date(`${fechaInicio}T05:00:00.000Z`),
        freq, diasPeriodo: calc.diasPeriodo,
      })
    : fechaFinCalc
  const modoInteresFinal = calc.modoInteres  // 'manual' si hubo cuotaManual

  // Validar abono vs total
  if (abono > totalAPagar) {
    return Response.json({ error: 'El abono no puede ser mayor al total a pagar' }, { status: 400 })
  }

  // Leer config de modo estricto de la organización
  const orgConfig = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { capitalEstricto: true, requiereAprobacionPrestamos: true },
  })
  const modoEstricto = !!orgConfig?.capitalEstricto
  const esPendiente = rol === 'cobrador' && !!orgConfig?.requiereAprobacionPrestamos

  // Normalizar inyección previa (si viene del frontend al elegir "inyectar y continuar")
  const inyeccionMonto = Number(inyeccionPrevia?.monto) || 0
  const inyeccionDescripcion = typeof inyeccionPrevia?.descripcion === 'string'
    ? inyeccionPrevia.descripcion.trim()
    : ''

  if (socioId) {
    const socioValido = await prisma.socio.findFirst({
      where: { id: socioId, organizationId },
      select: { id: true },
    })
    if (!socioValido) {
      return Response.json({ error: 'Socio no encontrado' }, { status: 400 })
    }
  }

  // Crear préstamo y actualizar estado del cliente en transacción
  const prestamo = await prisma.$transaction(async (tx) => {
    if (!esPendiente) {
      // Lock + lectura del capital actual
      const capRow = await tx.$queryRaw`
        SELECT id, saldo FROM Capital WHERE organizationId = ${organizationId} FOR UPDATE
      `
      const tieneCapital = Array.isArray(capRow) && capRow.length > 0
      let saldoCap = tieneCapital ? Number(capRow[0].saldo || 0) : 0

      if (inyeccionMonto > 0 && tieneCapital) {
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'inyeccion',
          monto: inyeccionMonto,
          descripcion: inyeccionDescripcion || `Inyección al crear préstamo - ${cliente.nombre}`,
          referenciaTipo: 'caja_capital_manual',
          rutaId: rutaIdCapital,
          creadoPorId: session.user.id,
        })
        saldoCap += inyeccionMonto
      }

      if (modoEstricto && tieneCapital) {
        const neto = Number(montoPrestado) - abono
        if (saldoCap < neto) {
          faltanteCapital = neto - saldoCap
          saldoCapitalActual = saldoCap
          throw new Error('CAPITAL_INSUFICIENTE')
        }
      }
    }

    const nuevo = await tx.prestamo.create({
      data: {
        clienteId,
        organizationId,
        creadoPorId: session.user.id,
        montoPrestado: Number(montoPrestado),
        tasaInteres:   Number(tasaInteres),
        totalAPagar,
        cuotaDiaria,
        frecuencia:    freq,
        modoInteres:   modoInteresFinal,
        interesAdelantado: modoInteresFinal === 'solo_interes' && !!interesAdelantado && !esAbierto,
        sinPlazo: esAbierto,
        ...(typeof nombreProducto === 'string' && nombreProducto.trim() && { nombreProducto: nombreProducto.trim().slice(0, 100) }),
        diaCobroSemana: diaCobroSemanaDb,
        diaCobroMes:    diaCobroMesDb,
        diaCobroMes2:   diaCobroMes2Db,
        // La fecha del primer cobro se guarda con el prestamo. Sin ella, al leer
        // se volveria a derivar el calendario viejo —un mes entero desde que se
        // entrego el dinero, y despues anclado al dia de corte— y el prestamo
        // tendria dos verdades: una en su tabla y otra en «proximo cobro».
        ...(calc.primerCobro ? { primerCobro: calc.primerCobro } : {}),
        ...(socioId && { socioId }),
        ...(Array.isArray(calc.capitalExtra) && calc.capitalExtra.length > 0 && { capitalExtra: calc.capitalExtra }),
        /* ⚠ EN UN ABIERTO, `diasPlazo` Y `fechaFin` SON EL PRIMER PERÍODO, no
           un vencimiento. Las dos columnas son NOT NULL y las leen 79
           archivos: hacerlas nulas era el cambio grande que este diseño evita.
           Guardan el primer corte de interés, que es cierto, y la pantalla
           enseña «Abierto» en vez de una fecha. Sin esto, un abierto sin plazo
           en el cuerpo grababa `NaN` y la fila no entraba. */
        diasPlazo:     esAbierto ? calc.diasPeriodo : calc.numPeriodos * calc.diasPeriodo,
        fechaInicio:   new Date(`${fechaInicio}T05:00:00.000Z`),
        fechaFin,
        seguro:        !!seguro,
        ...(seguro && montoSeguro > 0 && { montoSeguro: Number(montoSeguro) }),
        ...(esPendiente && { estado: 'pendiente_aprobacion' }),
      },
    })

    if (Array.isArray(calc.tablaAmortizacion) && calc.tablaAmortizacion.length > 0) {
      await tx.cuotaAmortizacion.createMany({
        data: calc.tablaAmortizacion.map((p) => ({
          prestamoId: nuevo.id,
          numeroPeriodo: p.numeroPeriodo,
          capital: p.capital,
          interes: p.interes,
          cuotaTotal: p.cuotaTotal,
          saldoRestante: p.saldoRestante,
          fechaEsperada: p.fechaEsperada,
          pagado: 0,
        })),
      })
    }

    if (!esPendiente) {
      await tx.cliente.update({
        where: { id: clienteId },
        data:  { estado: 'activo' },
      })

      await registrarMovimientoCapital(tx, {
        organizationId,
        tipo: 'desembolso',
        monto: Number(montoPrestado),
        descripcion: `Desembolso préstamo a ${cliente.nombre}`,
        referenciaId: nuevo.id,
        referenciaTipo: 'prestamo',
        rutaId: rutaIdCapital,
        creadoPorId: session.user.id,
        metodoPago: cuentaDesembolso,
        metodoPagoId: cuentaDesembolsoId,
      })

      if (abono > 0) {
        await tx.pago.create({
          data: {
            prestamoId:     nuevo.id,
            organizationId,
            cobradorId:     session.user.id,
            montoPagado:    abono,
            tipo:           'completo',
            fechaPago:      new Date(`${fechaInicio}T05:00:00.000Z`),
            nota:           'Abono previo (préstamo en curso)',
          },
        })
        await refrescarTotalesPrestamo(tx, nuevo.id)
        await registrarMovimientoCapital(tx, {
          organizationId,
          tipo: 'recaudo',
          monto: abono,
          descripcion: `Abono previo préstamo en curso - ${cliente.nombre}`,
          referenciaId: nuevo.id,
          referenciaTipo: 'prestamo',
          // Es un recaudo de un cliente que SÍ tiene ruta: sin esto entra al
          // capital global y no a su sub-bolsa, y la ruta queda desviada. El
          // mismo olvido que dejó las 9 rutas de PRESTA MIL sin cuadrar.
          rutaId: cliente?.rutaId || null,
          creadoPorId: session.user.id,
        })
      }
    } else if (abono > 0) {
      // Guardar el abono previo pero sin movimiento de capital (se registra al aprobar)
      await tx.pago.create({
        data: {
          prestamoId:     nuevo.id,
          organizationId,
          cobradorId:     session.user.id,
          montoPagado:    abono,
          tipo:           'completo',
          fechaPago:      new Date(`${fechaInicio}T05:00:00.000Z`),
          nota:           'Abono previo (préstamo en curso)',
        },
      })
      await refrescarTotalesPrestamo(tx, nuevo.id)
    }

    return nuevo
  })

  /* ── EL ABIERTO CON FECHA HACIA ATRÁS DEVENGA YA, NO AL AMANECER ──────────
   *
   * Reportado por Rhoders (FACIL) el 19 ago 2026, con la captura tomada un
   * minuto después de crear el préstamo: «debería salir en mora los intereses
   * que se deben […] y no al día, porque aún no ha pagado los intereses».
   *
   * Prestó $690.000 al 10% con fecha de inicio del 1 de julio, así que el
   * período que cerró el 1 de agosto ya se debía. El cron del devengo funciona
   * —corrió ese día a las 00:05 y no había nada que asentar— pero **el préstamo
   * se creó diez horas después**. Hasta el amanecer siguiente enseñaba una
   * deuda que no era y un «al día» que era mentira.
   *
   * No revienta la creación si falla: el préstamo ya está guardado y el cron lo
   * recoge esa noche. Ver lib/dinero/devengar.js. */
  if (esAbierto && !esPendiente) await devengarAlCrear(prisma, prestamo.id)

  logActividad({ session, accion: esPendiente ? 'solicitar_prestamo' : 'crear_prestamo', entidadTipo: 'prestamo', entidadId: prestamo.id, detalle: `${esPendiente ? 'Solicitud de préstamo' : 'Préstamo'} $${Number(montoPrestado).toLocaleString('es-CO')} a ${cliente.nombre}${abono > 0 ? ` (en curso, abono previo $${abono.toLocaleString('es-CO')})` : ''}`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: esPendiente ? 'solicitar_prestamo' : 'crear_prestamo', metadata: { monto: Number(montoPrestado) } })

  if (esPendiente) {
    const owners = await prisma.user.findMany({
      where: { organizationId, rol: 'owner' },
      select: { id: true },
    })
    if (owners.length > 0) {
      await prisma.notificacion.createMany({
        data: owners.map(o => ({
          organizationId,
          userId: o.id,
          tipo: 'solicitud_prestamo',
          titulo: 'Solicitud de prestamo',
          mensaje: `${session.user.nombre} solicita crear un prestamo de $${Number(montoPrestado).toLocaleString('es-CO')} para ${cliente.nombre}.`,
          datos: JSON.stringify({ prestamoId: prestamo.id, clienteId, monto: Number(montoPrestado), cobrador: session.user.nombre }),
        })),
      })
    }
    enviarPushOrg(organizationId, {
      title: 'Solicitud de prestamo',
      body: `${session.user.nombre} solicita $${Number(montoPrestado).toLocaleString('es-CO')} para ${cliente.nombre}`,
      url: `/prestamos/${prestamo.id}`,
    }).catch(() => {})
  }

  return Response.json({ ...prestamo, pendienteAprobacion: esPendiente }, { status: 201 })
  } catch (err) {
    if (err?.message === 'CAPITAL_INSUFICIENTE') {
      return Response.json({
        error: 'Capital insuficiente para desembolsar este préstamo',
        capitalInsuficiente: true,
        faltante: Math.round(faltanteCapital),
        saldoActual: Math.round(saldoCapitalActual),
      }, { status: 400 })
    }
    console.error('[POST /api/prestamos]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
