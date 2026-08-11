// app/api/clientes/route.js

import { getServerSession } from 'next-auth'
import { authOptions }      from '@/lib/auth'
import { prisma }           from '@/lib/prisma'
import {
  LIMITES_PLAN, calcularEstadoCliente, calcularDiasMora, calcularSaldoPendiente,
  calcularPorcentajePagado, calcularProximoCobro, formatFechaCobroContextual,
  // La tira de cifras de T03-03: el atraso en plata y el cumplimiento.
  calcularMontoEnMora, calcularCuotasEnMora, calcularCuotasPendientes, tieneTablaAmortizacion,
  // El desglose por prestamo: cuanto de MI plata sigue afuera en cada uno.
  calcularCapitalRestante,
} from '@/lib/calculos'
import { obtenerDiasSinCobro, validarDiasSinCobro } from '@/lib/dias-sin-cobro'
import { logActividad } from '@/lib/activity-log'
import { geocodeAddress }   from '@/lib/geocoding'
import { trackEvent } from '@/lib/analytics'
import { getUtcOffset, validateDocument, getDocumentConfig, inicioDelDiaLocal } from '@/lib/i18n'
import { bloquearSiSuscripcionVencida } from '@/lib/suscripcion'
import { rutaPermitida } from '@/lib/limites-plan'
import { dispararTrasCrear } from '@/lib/capi-activacion'

// ─── GET /api/clientes ──────────────────────────────────────────
export async function GET(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const buscar = searchParams.get('buscar')?.trim() ?? ''
  const rutaIdFiltro = searchParams.get('rutaId')?.trim() ?? ''
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : null
  const limit = Math.min(Number(searchParams.get('limit')) || 50, 100)

  const { organizationId, rol, rutaIds = [] } = session.user

  // Cobrador sin rutas asignadas no ve nada (previene fuga multi-tenant)
  if (rol === 'cobrador' && rutaIds.length === 0) {
    return Response.json(page != null ? { clientes: [], total: 0, page, totalPages: 0 } : [])
  }

  // Cobrador → clientes de sus rutas + clientes sin ruta que el cobrador creó.
  // Owner puede filtrar por ruta específica.
  const filtroRuta = rol === 'cobrador'
    ? { OR: [{ rutaId: { in: rutaIds } }, { rutaId: null, creadoPorId: session.user.id }] }
    : (rutaIdFiltro ? { rutaId: rutaIdFiltro } : {})

  // Filtro de búsqueda por nombre, cédula, teléfono o referencia
  const filtroBuscar = buscar
    ? {
        OR: [
          { nombre:    { contains: buscar } },
          { cedula:    { contains: buscar } },
          { telefono:  { contains: buscar } },
          { referencia: { contains: buscar } },
          // Un prestamista ubica a la gente por donde vive, no solo por nombre.
          { direccion: { contains: buscar } },
        ],
      }
    : {}

  /* ── DOS FILTROS QUE NO EXISTÍAN ─────────────────────────────────────────
     «Sería bastante ideal que se pudiera identificar fácilmente si uno va a
     buscar un cliente nuevo, si va a buscar un cliente con clavo.»

     Los dos se resuelven en SQL, así que la paginación y los conteos siguen
     siendo ciertos — al revés que la mora, que hay que calcular en JS.

     ⚠ «De hoy» es la JORNADA —05:00Z a 05:00Z, la misma frontera que la caja y
     el cierre— y NO una ventana de 24 horas. Ver la nota larga en
     `/api/prestamos`: la pregunta que se hace con este chip es de supervisión
     («¿a quién cargó mi cobrador hoy?») y tiene que cuadrar con el día.

     La pastilla «Nuevo» de la tarjeta SÍ se queda en 24 horas (`esNuevo` en el
     adaptador), y por eso el chip no se llama «Nuevos»: son dos preguntas
     distintas y el nombre las separa. */
  const soloNuevos = searchParams.get('nuevos') === '1'
  const soloConClavo = searchParams.get('clavo') === '1'

  // Clientes sin ruta asignada. Existe para que la alerta "N clientes sin ruta"
  // del dashboard tenga a donde llevar: antes enlazaba a /clientes pelado y
  // caias al listado completo, sin forma de saber cuales eran.
  const soloSinRuta = searchParams.get('sinRuta') === '1'

  // ── FILTROS QUE NO SE PUEDEN HACER EN SQL ──
  //
  // La mora de un cliente no es una columna: depende de sus prestamos, de los
  // dias sin cobro de su ruta, de los festivos y del calendario de cada uno. Se
  // calcula abajo, DESPUES de traer las filas.
  //
  // Y ahi esta el problema: la paginacion la hace la base ANTES de ese calculo,
  // asi que filtrar por mora sobre la pagina ya cortada solo mira 50 clientes y
  // MIENTE — con 200 en cartera, «en mora» enseñaria los que hubiera entre los
  // primeros 50 y diria que no hay mas.
  //
  // Cuando se pide uno de estos, se trae la cartera entera, se calcula, se
  // filtra y se pagina aqui. Es mas caro, pero es el unico resultado cierto.
  // Cuando NO se pide —el caso de todos los dias— no cambia nada.
  const moraMin = Number(searchParams.get('mora') || 0) || 0
  const pagaHoy = searchParams.get('pagaHoy') === '1'
  const sinPrestamo = searchParams.get('sinPrestamo') === '1'
  // `estado` (al dia / mora / cancelado) es de la misma familia: lo calcula
  // `calcularEstadoCliente()` DESPUES de traer las filas, no es una columna.
  // Filtrarlo en el navegador sobre la pagina de 50 es justo lo que hacia la
  // pantalla, y por eso el panel podia decir «18 en mora» y la lista enseñar 4.
  const estadoFiltro = searchParams.get('estado')?.trim() ?? ''
  // Los CONTEOS de los chips tienen el mismo problema: se contaban sobre la
  // pagina. Con `soloConteos=1` se hace la pasada completa y se devuelven solo
  // los numeros, sin la lista — una peticion barata que da cifras ciertas.
  const soloConteos = searchParams.get('soloConteos') === '1'
  const filtraCalculado = moraMin > 0 || pagaHoy || sinPrestamo || !!estadoFiltro || soloConteos

  const condiciones = [
    { organizationId },
    { estado: { notIn: ['eliminado'] } },
  ]
  if (soloSinRuta) condiciones.push({ rutaId: null })
  if (soloNuevos) condiciones.push({ createdAt: { gte: inicioDelDiaLocal(session.user.country ?? 'co') } })
  // Un clavo VIVO: `estado: 'activo'` porque un préstamo perdido y ya cancelado
  // no es una alarma, es historia.
  if (soloConClavo) condiciones.push({ prestamos: { some: { esClavo: true, estado: 'activo' } } })

  // Clientes sin numero guardado. Existe por el mismo motivo que `sinRuta`: el
  // aviso de «N clientes no tienen numero» de Avisos por WhatsApp tiene que
  // poder llevar a QUIENES son. Sin esto el aviso da una cifra y deja al dueño
  // buscandolos uno por uno en toda la cartera.
  if (searchParams.get('sinTelefono') === '1') {
    condiciones.push({ OR: [{ telefono: null }, { telefono: '' }] })
  }
  if (Object.keys(filtroRuta).length) condiciones.push(filtroRuta)
  if (Object.keys(filtroBuscar).length) condiciones.push(filtroBuscar)

  const whereClause = { AND: condiciones }

  const clientes = await prisma.cliente.findMany({
    where: whereClause,
    select: {
      id:         true,
      nombre:     true,
      cedula:     true,
      telefono:   true,
      referencia: true,
      estado:     true,
      rutaId:     true,
      fotoUrl:    true,
      createdAt:  true,
      diasSinCobro: true,
      montoMaximoPrestamo: true,
      ruta:       { select: { id: true, nombre: true, diasSinCobro: true } },
      prestamos: {
        where:  { estado: 'activo' },
        select: {
          id: true,
          estado: true,
          fechaInicio: true,
          fechaFin: true,
          cuotaDiaria: true,
          diasPlazo: true,
          frecuencia: true,
          totalAPagar: true,
          montoPrestado: true,
          modoInteres: true,
          // Para el desglose: sin la tasa, la ficha de cada prestamo no puede
          // decir en que se pacto, y el mismo «20%» significa cosas distintas
          // segun el modo.
          tasaInteres: true,
          diaCobroMes: true,
          diaCobroMes2: true,
          diaCobroSemana: true,
          esClavo: true,
          createdAt: true,
          proximoCobroManual: true,
          // Denormalizados: evitan iterar todos los pagos.
          totalPagado: true,
          ultimoPagoAt: true,
          cuotasAmortizacion: {
            select: { numeroPeriodo: true, cuotaTotal: true, interes: true, capital: true, pagado: true, interesPagado: true, fechaEsperada: true },
            orderBy: { numeroPeriodo: 'asc' },
          },
        },
      },
      lineasCredito: {
        where: { estado: 'activa' },
        select: { id: true },
      },
      ...(rol !== 'cobrador' && { creadoPor: { select: { id: true, nombre: true } } }),
    },
    orderBy: [{ ordenRuta: 'asc' }, { nombre: 'asc' }],
    // Sin `take/skip` cuando hay filtro calculado: se corta despues, ya filtrado.
    ...(page != null && !filtraCalculado && { take: limit, skip: (page - 1) * limit }),
  })

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

  // Inicio del dia hoy en hora Colombia para detectar pagoHoy
  const country = session.user.country ?? 'co'
  const hoyCO = new Date(Date.now() - Math.abs(getUtcOffset(country)) * 60 * 60 * 1000)
  const inicioHoyUTC = new Date(Date.UTC(hoyCO.getUTCFullYear(), hoyCO.getUTCMonth(), hoyCO.getUTCDate(), 5, 0, 0))

  // Cachear diasExcluidos por cliente (era N+1 antes).
  const diasExcluidosCache = new Map()
  const getDiasExcluidos = (cliente) => {
    if (!cliente?.id) return obtenerDiasSinCobro(cliente, cliente?.ruta, org)
    if (!diasExcluidosCache.has(cliente.id)) {
      diasExcluidosCache.set(cliente.id, obtenerDiasSinCobro(cliente, cliente?.ruta, org))
    }
    return diasExcluidosCache.get(cliente.id)
  }

  // Recalcular estado real del cliente y enriquecer con datos para la card.
  const resultado = clientes.map((c) => {
    const diasExcluidos = getDiasExcluidos(c)
    let saldoTotal = 0
    let totalAPagarSum = 0
    let diasMoraMax = 0
    let pagoHoy = false
    let proximoCobroMin = null
    // ── LA TIRA DE CIFRAS DE T03-03 ──
    // El atraso EN PLATA (la pastilla ya dice los dias) y el cumplimiento. Los
    // dos se acumulan aca porque necesitan los dias excluidos y los festivos de
    // la organizacion, que el navegador no tiene.
    let montoEnMoraTotal = 0
    let cuotasVencidas = 0     // las que ya debian estar pagadas
    let cuotasPagadasSum = 0
    // ── EL DESGLOSE, PRESTAMO POR PRESTAMO ──────────────────────────────
    //
    // La tarjeta decia «3 prestamos» y despues generalizaba TODOS los KPI en
    // una sola tira: un atraso, un cumplimiento, un «cobra el». Con tres
    // creditos abiertos eso ultimo es directamente otra cosa —cada prestamo
    // tiene su propio dia de cobro— y para saber cual esta mal habia que
    // entrar a la ficha del cliente.
    //
    // No cuesta una consulta mas: este bucle YA calcula el saldo, la mora, el
    // proximo cobro y las cuotas de cada prestamo para poder sumarlos. Lo
    // unico que faltaba era no tirar las piezas despues de sumarlas.
    const desglose = []

    for (const p of c.prestamos) {
      let saldoP = 0, diasMoraP = 0, moraP = 0, proxP = null
      let cuotasTotalP = 0, cuotasPendP = 0
      try { saldoP = calcularSaldoPendiente(p); saldoTotal += saldoP } catch (e) {
        console.error(`[clientes] calcularSaldoPendiente falló para préstamo ${p.id}:`, e.message)
      }
      totalAPagarSum += (p.totalAPagar ?? 0)
      try {
        const dm = calcularDiasMora(p, diasExcluidos, festivos)
        diasMoraP = dm
        if (dm > diasMoraMax) diasMoraMax = dm
      } catch (e) {
        console.error(`[clientes] calcularDiasMora falló para préstamo ${p.id}:`, e.message)
      }
      if (!pagoHoy && p.ultimoPagoAt && new Date(p.ultimoPagoAt) >= inicioHoyUTC) {
        pagoHoy = true
      }
      try {
        const prox = calcularProximoCobro(p, diasExcluidos, festivos)
        proxP = prox ?? null
        if (prox && (!proximoCobroMin || prox < proximoCobroMin)) proximoCobroMin = prox
      } catch (e) {
        console.error(`[clientes] calcularProximoCobro falló para préstamo ${p.id}:`, e.message)
      }
      try {
        moraP = calcularMontoEnMora(p, diasExcluidos, festivos)
        montoEnMoraTotal += moraP
        // CUMPLIMIENTO = de las cuotas que YA debian estar pagadas, cuantas lo
        // estan. Las pagadas salen de `totalCuotas - cuotasPendientes`; las que
        // ya vencieron son esas mismas mas las que estan en mora.
        //
        // ATENCION: esta definicion la puse yo. La lamina T03-03 pinta «Cumple
        // 31%» y no dice como se calcula, y no hay ninguna funcion de
        // cumplimiento en el repo. Es la unica lectura sensata de la palabra
        // —de lo que ya tocaba, cuanto pago— pero si el diseñador queria otra
        // cosa, se cambia AQUI y en ningun otro sitio.
        const total = tieneTablaAmortizacion(p)
          ? p.cuotasAmortizacion.length
          : (p.cuotaDiaria > 0 ? Math.ceil((p.totalAPagar || 0) / p.cuotaDiaria) : 0)
        const pendientes = calcularCuotasPendientes(p)
        const pagadas = Math.max(0, total - pendientes)
        const enMora = calcularCuotasEnMora(p, diasExcluidos, festivos)
        cuotasTotalP = total
        cuotasPendP = pendientes
        cuotasPagadasSum += pagadas
        cuotasVencidas += pagadas + enMora
      } catch (e) {
        console.error(`[clientes] la tira de cifras fallo para prestamo ${p.id}:`, e.message)
      }

      // Una fila por prestamo, con lo mismo que ya manda `/api/prestamos` para
      // su propia lista. Los nombres son los MISMOS a proposito: el desplegable
      // de la tarjeta de cliente y la tarjeta de prestamo comparten adaptador,
      // y dos juegos de nombres distintos para el mismo dato acaban en dos
      // definiciones de «saldo» que se separan sin que nadie lo note.
      desglose.push({
        id:               p.id,
        estado:           p.estado,
        fechaInicio:      p.fechaInicio,
        fechaFin:         p.fechaFin,
        createdAt:        p.createdAt,
        frecuencia:       p.frecuencia,
        // `diasPlazo` lo usa la hoja de pago para escribir «cuota 13 de 24»
        // cuando el prestamo no tiene tabla de amortizacion. Sin el, el cobro
        // rapido desde la tarjeta de cliente salia sin ese renglon y el de la
        // lista de prestamos con el: el mismo modal diciendo dos cosas.
        diasPlazo:        p.diasPlazo,
        modoInteres:      p.modoInteres,
        tasaInteres:      p.tasaInteres,
        cuotaDiaria:      p.cuotaDiaria,
        montoPrestado:    p.montoPrestado,
        totalAPagar:      p.totalAPagar,
        totalPagado:      p.totalPagado ?? 0,
        ultimoPagoAt:     p.ultimoPagoAt,
        esClavo:          p.esClavo,
        saldoPendiente:   saldoP,
        porcentajePagado: (() => {
          try { return calcularPorcentajePagado(p) } catch { return 0 }
        })(),
        capitalRestante:  (() => {
          try { return calcularCapitalRestante(p) } catch { return null }
        })(),
        diasMora:         diasMoraP,
        montoEnMora:      moraP,
        totalCuotas:      cuotasTotalP,
        cuotasPendientes: cuotasPendP,
        proximoCobro:     proxP,
      })
    }

    const porcentajePagadoPromedio = totalAPagarSum > 0
      ? Math.round(((totalAPagarSum - saldoTotal) / totalAPagarSum) * 100)
      : 0

    return {
      id:               c.id,
      nombre:           c.nombre,
      cedula:           c.cedula,
      telefono:         c.telefono,
      referencia:       c.referencia,
      fotoUrl:          c.fotoUrl ?? null,
      estado:           calcularEstadoCliente(c.prestamos, diasExcluidos, festivos),
      rutaId:           c.rutaId,
      rutaNombre:       c.ruta?.nombre ?? null,
      prestamosActivos: c.prestamos.length,
      // El desglose del desplegable. Va ordenado por lo que se cobra ANTES:
      // abierto, lo primero que se lee es a cual hay que ir hoy.
      prestamos: desglose.slice().sort((a, b) => {
        const ta = a.proximoCobro ? new Date(a.proximoCobro).getTime() : Infinity
        const tb = b.proximoCobro ? new Date(b.proximoCobro).getTime() : Infinity
        if (ta !== tb) return ta - tb
        return (b.saldoPendiente ?? 0) - (a.saldoPendiente ?? 0)
      }),
      montoEnMora:      montoEnMoraTotal,
      // Sin nada vencido todavia no hay nada que cumplir: `null`, no 0%. Un 0%
      // en un cliente que acaba de recibir el prestamo lo pinta como el peor de
      // la lista, y es justo al reves.
      cumplimiento:     cuotasVencidas > 0 ? Math.round((cuotasPagadasSum / cuotasVencidas) * 100) : null,
      lineasCreditoActivas: c.lineasCredito?.length ?? 0,
      creadoPor:        c.creadoPor ?? null,
      createdAt:        c.createdAt,
      // Actividad reciente del cliente: MAX(createdAt cliente, prestamos.createdAt).
      // Los pagos NO mueven la posicion — solo un prestamo nuevo (o cliente nuevo) sube.
      _actividadAt:     (() => {
        let max = new Date(c.createdAt).getTime()
        for (const p of c.prestamos) {
          const tc = p.createdAt ? new Date(p.createdAt).getTime() : 0
          if (tc > max) max = tc
        }
        return max
      })(),
      // Nuevos campos para card rediseñada
      saldoPendienteTotal:       saldoTotal,
      diasMoraMax,
      pagoHoy,
      porcentajePagadoPromedio,
      // La fecha cruda, ademas de la etiqueta: el filtro «le toca hoy» no puede
      // leer «mañana» ni «hace 3 dias».
      proximoCobro: proximoCobroMin,
      proximoCobroLabel: proximoCobroMin ? formatFechaCobroContextual(proximoCobroMin, diasMoraMax) : null,
      tieneClavo: c.prestamos.some(pr => pr.esClavo && pr.estado === 'activo'),
    }
  })

  // Reordenar por actividad reciente del cliente. Tie-break: createdAt cliente desc.
  resultado.sort((a, b) => {
    if (a._actividadAt !== b._actividadAt) return b._actividadAt - a._actividadAt
    return new Date(b.createdAt) - new Date(a.createdAt)
  })
  for (const c of resultado) delete c._actividadAt

  // Los filtros que necesitan el calculo hecho.
  // Los conteos por estado, sobre la cartera ENTERA. Solo se calculan cuando ya
  // se ha hecho la pasada completa, asi que no cuestan nada extra.
  if (soloConteos) {
    const conteos = { total: resultado.length, activo: 0, mora: 0, cancelado: 0 }
    for (const c of resultado) {
      if (conteos[c.estado] !== undefined) conteos[c.estado] += 1
    }
    return Response.json(conteos)
  }

  let filtrado = resultado
  const hoyISO = new Date().toISOString().slice(0, 10)
  if (filtraCalculado) {
    filtrado = resultado.filter((c) => {
      if (estadoFiltro && c.estado !== estadoFiltro) return false
      // «Le toca pagar hoy»: la fecha del proximo cobro mas cercano es hoy o ya
      // paso. Incluye los atrasados a proposito — a esos tambien les toca, y
      // dejarlos fuera seria justo esconder a los que hay que ir a ver.
      //
      // Se compara la fecha en texto (AAAA-MM-DD) y no con `Date`: los cobros se
      // guardan a las 05:00Z por el convenio de la casa, asi que el trozo de
      // fecha del ISO ES el dia que toca, mire desde donde se mire.
      if (pagaHoy) {
        const dia = c.proximoCobro ? new Date(c.proximoCobro).toISOString().slice(0, 10) : null
        if (!dia || dia > hoyISO) return false
      }
      if (moraMin > 0 && Number(c.diasMoraMax ?? 0) < moraMin) return false
      // «Sin prestamo activo»: el cliente que esta en la cartera y no debe nada.
      // Es al que hay que volver a prestarle, y hasta ahora no habia forma de
      // encontrarlo sin recorrer la lista entera a mano.
      if (sinPrestamo && Number(c.prestamosActivos ?? 0) > 0) return false
      return true
    })
  }

  // If paginated, return object with total; otherwise array for backward compat
  if (page != null) {
    if (filtraCalculado) {
      // El total es el de LO FILTRADO, no el de la cartera: si dice 200 y
      // enseña 3, el usuario cree que se perdieron 197.
      const total = filtrado.length
      const desde = (page - 1) * limit
      return Response.json({
        clientes: filtrado.slice(desde, desde + limit),
        total, page, totalPages: Math.ceil(total / limit),
      })
    }
    const total = await prisma.cliente.count({ where: whereClause })
    return Response.json({ clientes: filtrado, total, page, totalPages: Math.ceil(total / limit) })
  }
  return Response.json(filtrado)
  } catch (err) {
    console.error('[GET /api/clientes]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}

// ─── POST /api/clientes ─────────────────────────────────────────
export async function POST(request) {
  try {
  const session = await getServerSession(authOptions)
  if (!session?.user?.organizationId) {
    return Response.json({ error: 'No autorizado' }, { status: 401 })
  }
  const bloqueoSub = await bloquearSiSuscripcionVencida(session)
  if (bloqueoSub) return bloqueoSub
  // Verificar permisos: owner siempre puede, cobrador solo si tiene permiso
  let autoRutaId = null
  if (session.user.rol !== 'owner') {
    if (session.user.rol === 'cobrador') {
      const cobrador = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { puedeCrearClientes: true },
      })
      if (!cobrador?.puedeCrearClientes) {
        return Response.json({ error: 'No tienes permiso para crear clientes' }, { status: 403 })
      }
      // Auto-asignar a la ruta del cobrador
      autoRutaId = (session.user.rutaIds ?? [])[0] || session.user.rutaId || null
    } else {
      return Response.json({ error: 'No autorizado' }, { status: 403 })
    }
  }

  const { organizationId, plan } = session.user

  /* ══ EL LÍMITE DE CLIENTES, CON SU CUPO EXTRA ════════════════════════════
   *
   * ⚠ ESTE ES EL SITIO QUE DE VERDAD BLOQUEA. Los otros tres —`limites-plan`,
   * `api/plan/uso` y la pantalla de plan— solo INFORMAN; aquí es donde se dice
   * que no. Se me pasó al primer barrido porque tiene su propia lista
   * (`LIMITES_PLAN`) en vez de leer `PLANES_CONFIG` como los demás.
   *
   * Dos cosas cambian:
   *
   * 1. Se suma `clientesExtra`, el cupo por cuenta. Es el mismo patrón que
   *    `cobradoresExtra` y `rutasExtra`, y sirve cuando a alguien se le
   *    prometió más de lo que su plan da sin forzarle a subir de plan.
   *
   * 2. El plan sale de la BASE, no del JWT. El plan del token no se refresca
   *    sin volver a entrar —está documentado en este proyecto—, así que a quien
   *    acababa de subir de plan se le seguía aplicando el viejo hasta que
   *    cerrara sesión.
   */
  const orgLimites = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true, clientesExtra: true },
  })
  const planReal = orgLimites?.plan || plan
  const limite = (LIMITES_PLAN[planReal] ?? LIMITES_PLAN.basic) + (orgLimites?.clientesExtra ?? 0)
  if (isFinite(limite)) {
    const total = await prisma.cliente.count({ where: { organizationId, estado: { notIn: ['eliminado'] } } })
    if (total >= limite) {
      return Response.json(
        { error: `Tu plan permite máximo ${limite} clientes. Considera actualizar.` },
        { status: 403 }
      )
    }
  }

  const body = await request.json()
  // `cedula` con `let`: cuando no viene se le pone el marcador «SIN-…» unas
  // lineas mas abajo, y con `const` eso seria un error en ejecucion.
  const { nombre, telefono, direccion, referencia, notas, fotoUrl, rutaId, latitud, longitud, diasSinCobro, posicionEnRuta } = body
  let { cedula } = body

  let diasSinCobroVal
  try {
    diasSinCobroVal = diasSinCobro !== undefined ? validarDiasSinCobro(diasSinCobro) : undefined
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 })
  }

  // Validaciones básicas
  // ── SOLO EL NOMBRE (T07-03) ──
  // Exigia los tres. La carga masiva desde Excel ya aceptaba clientes sin
  // telefono, asi que se podian importar doscientos sin numero y no se podia
  // crear uno a mano. Y pedir datos en la calle es lo que frena la carga.
  //
  // La cedula sigue siendo la clave con la que se busca y se evita el
  // duplicado, asi que cuando no viene se genera el mismo marcador «SIN-…» que
  // ya usaba la casilla «no tiene cedula» y la importacion de cuadernos.
  if (!nombre?.trim()) return Response.json({ error: 'El nombre es requerido' }, { status: 400 })
  if (!cedula?.trim()) {
    cedula = `SIN-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  }

  const esSinCedula = cedula.trim().startsWith('SIN-')
  const country = session.user.country ?? 'co'
  const docConfig = getDocumentConfig(country)
  if (!esSinCedula && !validateDocument(cedula.trim(), country)) {
    return Response.json({ error: `${docConfig.label} no válido (ej: ${docConfig.placeholder})` }, { status: 400 })
  }

  // Verificar cédula única en la organización (SIN- son siempre únicos, skip check)
  const existe = !esSinCedula ? await prisma.cliente.findUnique({
    where: { organizationId_cedula: { organizationId, cedula: cedula.trim() } },
    select: { id: true, estado: true },
  }) : null
  if (existe) {
    // Si el cliente fue eliminado (soft-delete), reactivarlo con los datos nuevos
    if (existe.estado === 'eliminado') {
      const reactivado = await prisma.cliente.update({
        where: { id: existe.id },
        data: {
          nombre:     nombre.trim(),
          telefono:   telefono.trim(),
          direccion:  direccion?.trim()  || null,
          referencia: referencia?.trim()  || null,
          notas:      notas?.trim()      || null,
          fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null,
          rutaId:     rutaId || null,
          estado:     'activo',
          eliminadoEn: null,
        },
      })
      logActividad({ session, accion: 'reactivar_cliente', entidadTipo: 'cliente', entidadId: reactivado.id, detalle: `Cliente reactivado ${nombre.trim()} (${cedula.trim()})`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
      trackEvent({ organizationId, userId: session.user.id, evento: 'reactivar_cliente' })
      return Response.json(reactivado, { status: 201 })
    }
    // Devolver existingId permite al sync offline mapear su tempId al cliente
    // que ya existía (p.ej. el mismo cobrador creó el cliente desde otra sesión).
    return Response.json(
      { error: 'Ya existe un cliente con esa cédula', existingId: existe.id },
      { status: 409 }
    )
  }

  // Si se envía rutaId, verificar que pertenece a la organización.
  // Para cobradores, ademas debe ser una de sus rutas asignadas.
  if (rutaId) {
    const ruta = await prisma.ruta.findFirst({
      where: { id: rutaId, organizationId },
    })
    if (!ruta) {
      return Response.json({ error: 'Ruta no válida' }, { status: 400 })
    }
    if (session.user.rol === 'cobrador' && !(session.user.rutaIds ?? []).includes(rutaId)) {
      return Response.json({ error: 'Solo puedes crear clientes en tus rutas asignadas' }, { status: 403 })
    }
    if (!await rutaPermitida(organizationId, rutaId)) {
      return Response.json({ error: 'Esta ruta excede el limite de tu plan. Mejora tu plan o desactiva rutas que no uses.' }, { status: 403 })
    }
  }

  // Resolver coordenadas: GPS directo > geocodificación de dirección
  let lat = latitud ?? null
  let lng = longitud ?? null
  if (lat == null && lng == null && direccion?.trim()) {
    const geo = await geocodeAddress(direccion.trim())
    if (geo) { lat = geo.lat; lng = geo.lng }
  }

  const rutaFinal = rutaId || autoRutaId || null
  let ordenRutaFinal = null

  if (rutaFinal && posicionEnRuta) {
    // Calcular el ordenRuta según la posición solicitada
    await prisma.$transaction(async (tx) => {
      const clientesRuta = await tx.cliente.findMany({
        where: { rutaId: rutaFinal, organizationId },
        select: { id: true, ordenRuta: true },
        orderBy: { ordenRuta: 'asc' },
      })

      if (posicionEnRuta === 'inicio') {
        // Desplazar todos +1 y poner el nuevo en 0
        for (const c of clientesRuta) {
          await tx.cliente.update({
            where: { id: c.id },
            data: { ordenRuta: (c.ordenRuta ?? 0) + 1 },
          })
        }
        ordenRutaFinal = 0
      } else if (posicionEnRuta === 'final') {
        const max = clientesRuta.reduce((m, c) => Math.max(m, c.ordenRuta ?? 0), -1)
        ordenRutaFinal = max + 1
      } else {
        // posicionEnRuta es un clienteId → insertar después de ese cliente
        const idx = clientesRuta.findIndex(c => c.id === posicionEnRuta)
        if (idx >= 0) {
          const ordenDespuesDe = clientesRuta[idx].ordenRuta ?? 0
          // Desplazar los que están después
          for (const c of clientesRuta) {
            if ((c.ordenRuta ?? 0) > ordenDespuesDe) {
              await tx.cliente.update({
                where: { id: c.id },
                data: { ordenRuta: (c.ordenRuta ?? 0) + 1 },
              })
            }
          }
          ordenRutaFinal = ordenDespuesDe + 1
        } else {
          // Cliente referencia no encontrado, poner al final
          const max = clientesRuta.reduce((m, c) => Math.max(m, c.ordenRuta ?? 0), -1)
          ordenRutaFinal = max + 1
        }
      }
    })
  } else if (rutaFinal) {
    // Sin posición explícita: poner al final
    const maxOrden = await prisma.cliente.aggregate({
      where: { rutaId: rutaFinal, organizationId },
      _max: { ordenRuta: true },
    })
    ordenRutaFinal = (maxOrden._max.ordenRuta ?? -1) + 1
  }

  const cliente = await prisma.cliente.create({
    data: {
      organizationId,
      nombre:     nombre.trim(),
      cedula:     cedula.trim(),
      telefono:   telefono.trim(),
      direccion:  direccion?.trim()  || null,
      referencia: referencia?.trim()  || null,
      notas:      notas?.trim()      || null,
      fotoUrl:    fotoUrl?.trim() && /^https?:\/\/.+/i.test(fotoUrl.trim()) ? fotoUrl.trim() : null,
      rutaId:     rutaFinal,
      latitud:    lat,
      longitud:   lng,
      creadoPorId: session.user.id,
      ...(diasSinCobroVal !== undefined && { diasSinCobro: diasSinCobroVal }),
      ...(ordenRutaFinal != null && { ordenRuta: ordenRutaFinal }),
    },
  })

  if (session.user.rol === 'cobrador') {
    const owners = await prisma.user.findMany({
      where: { organizationId, rol: 'owner' },
      select: { id: true },
    })
    for (const o of owners) {
      await prisma.notificacion.create({
        data: {
          organizationId,
          userId: o.id,
          tipo: 'cliente_creado_por_cobrador',
          titulo: 'Nuevo cliente registrado',
          mensaje: `${session.user.name || 'Un cobrador'} registró al cliente ${nombre.trim()} (${cedula.trim()})`,
          datos: JSON.stringify({ clienteId: cliente.id, cobradorId: session.user.id, cobradorNombre: session.user.name }),
        },
      })
    }
  }

  logActividad({ session, accion: 'crear_cliente', entidadTipo: 'cliente', entidadId: cliente.id, detalle: `Cliente ${nombre.trim()} (${cedula.trim()})`, ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() })
  trackEvent({ organizationId, userId: session.user.id, evento: 'crear_cliente' })
  // Avisa a Meta si con este cliente la organizacion cruzo 6 o 21 clientes.
  // No se espera: si el CAPI tarda o falla, la respuesta al usuario no se frena.
  dispararTrasCrear({ organizationId, creados: 1 })
  return Response.json(cliente, { status: 201 })
  } catch (err) {
    console.error('[POST /api/clientes]', err)
    return Response.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
